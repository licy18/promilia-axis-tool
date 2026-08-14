import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import soulEssenceEffectCatalog from '../../data/generated/soulessence-effect-mechanics.json';
import verifiedCombatMechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { createActionExecutionPlan } from '../../simulation/engine/actionExecutionPlan';
import { createCanonicalCombatTrace } from '../../simulation/headless/canonicalHeadlessCombatCore';
import { createVerifiedCombatRuntime } from '../../simulation/mechanics/verifiedCombatRuntime';
import { createVerifiedKiboPassiveGeneration } from '../../simulation/mechanics/verifiedKiboPassiveGeneration';
import { createVerifiedNonDamageEventGeneration } from '../../simulation/mechanics/verifiedNonDamageEventGeneration';
import { createVerifiedSoulEssenceEffectGeneration } from '../../simulation/mechanics/verifiedSoulEssenceEffectGeneration';
import { createActionRuleDiagnostics } from '../../simulation/runtime/actionRuleDiagnostics';
import { createControlledActorTimeline } from '../../simulation/runtime/controlledActorTimeline';
import { createEffectRuntimeTimeline } from '../../simulation/runtime/effectRuntimeTimeline';

const VERIFIED_PROFILE_ID = 'azpr-three-value-verified-tc-20260718';
const PERIODIC_SKILL_ID = 520066;
const ROOT_ELEMENT_ID = 520066001;
const HEAL_ELEMENT_ID = 520066002;
const SOURCE_ACTOR_ID = 'actor-source';
const SOURCE_KIBO_ID = 500147;
const OTHER_SOURCE_KIBO_ID = 500148;
const SOURCE_SLOT_ID = 'team-slot-1';
const OTHER_ACTOR_ID = 'actor-other';

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified Kibo periodic-heal runtime', () => {
  it('routes a production actionless periodic heal through AfterHeal into set 5:4 exactly once', () => {
    const harness = runPeriodicRuntime({
      scenarioOptions: {
        durationMs: 20,
        actorCurrentHp: 1000,
      },
      targetKinds: ['actor'],
    });
    const sourceActor = harness.scenario.actors.find(
      actor => actor.id === SOURCE_ACTOR_ID
    );
    sourceActor.verifiedStaticProperties.setSkillActivations = [
      {
        setId: 5,
        pieces: 4,
        skillId: 19998007,
        thresholdMet: true,
        appliedToRuntimeEffect: true,
        sourceIdentity: 'fixture:c11-r1:set5-four-piece',
      },
    ];
    const periodicHeal = harness.runtime.vitalEvents.find(
      event => event.type === 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL'
    );
    const nonDamageEventGeneration = createVerifiedNonDamageEventGeneration({
      scenario: harness.scenario,
      actionExecutionPlan: harness.actionExecutionPlan,
      controlledActorTimeline: harness.controlledActorTimeline,
      actionResolutionById: new Map(),
      verifiedCombatRuntime: harness.runtime,
    });
    const definition = soulEssenceEffectCatalog.setSkillDefinitions.find(
      entry => entry.setId === 5 && entry.pieces === 4
    );
    const soulGeneration = createVerifiedSoulEssenceEffectGeneration({
      scenario: harness.scenario,
      actionExecutionPlan: harness.actionExecutionPlan,
      actionResolutionById: new Map(),
      nonDamageEventGeneration,
      catalog: {
        ...soulEssenceEffectCatalog,
        definitions: [],
        setSkillDefinitions: [definition],
      },
    });
    const timeline = createEffectRuntimeTimeline({
      scenario: {
        ...harness.scenario,
        time: { ...harness.scenario.time, durationMs: 7000 },
      },
      actionExecutionPlan: harness.actionExecutionPlan,
      generatedCommands: soulGeneration.effectCommands,
    });

    expect(periodicHeal).toMatchObject({
      actionId: null,
      actorId: SOURCE_ACTOR_ID,
      targetId: SOURCE_ACTOR_ID,
      sourceSequencePath: expect.any(Array),
      payload: {
        sourceEventIdentity: expect.stringContaining('kibo-periodic-heal|'),
        sourceAttributionStatus: 'native-first-root-source-verified',
        contributingSources: [
          expect.objectContaining({ sourceActorId: SOURCE_ACTOR_ID }),
        ],
      },
    });
    // 相对契约：真实周期治疗必须 requestedChange>0、change>0、HP 确实上升、前后值守恒
    const { beforeValue, requestedChange, change, afterValue } =
      periodicHeal.payload;
    expect(requestedChange).toBeGreaterThan(0);
    expect(change).toBeGreaterThan(0);
    expect(afterValue).toBeGreaterThan(beforeValue);
    expect(afterValue).toBe(beforeValue + change);
    expect(nonDamageEventGeneration.events).toEqual([
      expect.objectContaining({
        actionId: null,
        actorId: SOURCE_ACTOR_ID,
        targetId: SOURCE_ACTOR_ID,
        sourceSequencePath: periodicHeal.sourceSequencePath,
      }),
    ]);
    expect(soulGeneration.effectCommands).toEqual([
      expect.objectContaining({
        sourceActionId: null,
        sourceActorId: SOURCE_ACTOR_ID,
        targetId: SOURCE_ACTOR_ID,
        sourceSetId: 5,
        durationMs: expect.any(Number),
      }),
    ]);
    // 相对契约：set-skill 效果命令必须携带正时长（零时长实现不得通过）
    expect(soulGeneration.effectCommands[0].durationMs).toBeGreaterThan(0);
    expect(
      timeline.events.filter(event =>
        event.effectId?.startsWith('set-skill:5:4:')
      )
    ).toEqual([
      expect.objectContaining({ type: 'EFFECT_APPLIED' }),
      expect.objectContaining({ type: 'EFFECT_EXPIRED' }),
    ]);
  });

  it('keeps actionless periodic event identity and source sequence stable when unrelated descriptors are inserted', () => {
    const baseline = runPeriodicRuntime({ targetKinds: ['actor'] });
    const withUnrelatedDescriptor = runPeriodicRuntime({
      targetKinds: ['actor'],
      directHpEvents: [
        {
          timeMs: 1000,
          action: null,
          actionId: null,
          actorId: OTHER_ACTOR_ID,
          target: { kind: 'actor', id: OTHER_ACTOR_ID },
          value: 0,
          applied: true,
          sourceSequencePath: [Number.MAX_SAFE_INTEGER, 2, 999],
          effect: { effectIdentity: 'unrelated-out-of-horizon-heal' },
          sourceIdentity: { identity: 'unrelated-out-of-horizon-heal' },
        },
      ],
    });
    const baselineEvent = findPeriodicEvent(
      baseline.runtime,
      'actor',
      SOURCE_ACTOR_ID
    );
    const insertedEvent = findPeriodicEvent(
      withUnrelatedDescriptor.runtime,
      'actor',
      SOURCE_ACTOR_ID
    );

    expect(insertedEvent.sourceSequencePath).toEqual(
      baselineEvent.sourceSequencePath
    );
    expect(insertedEvent.payload.sourceEventIdentity).toBe(
      baselineEvent.payload.sourceEventIdentity
    );
  });

  it('projects the verified gameplay Kibo root attacker as the single-source Heal104 formula source', () => {
    const scenario = createPeriodicScenario();
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
    });

    expect(generation.periodicVitalSchedules).toHaveLength(2);
    expect(generation.periodicVitalSchedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetKind: 'actor',
          targetId: SOURCE_ACTOR_ID,
          sourceAttributionStatus: 'native-first-root-source-verified',
          formulaSource: expect.objectContaining({
            targetKind: 'kibo',
            targetId: SOURCE_ACTOR_ID,
            targetActorId: SOURCE_ACTOR_ID,
            targetKiboId: SOURCE_KIBO_ID,
            targetSlotId: SOURCE_SLOT_ID,
          }),
        }),
        expect.objectContaining({
          targetKind: 'kibo',
          targetId: SOURCE_ACTOR_ID,
          targetKiboId: SOURCE_KIBO_ID,
          sourceAttributionStatus: 'native-first-root-source-verified',
          formulaSource: expect.objectContaining({
            targetKind: 'kibo',
            targetId: SOURCE_ACTOR_ID,
            targetActorId: SOURCE_ACTOR_ID,
            targetKiboId: SOURCE_KIBO_ID,
            targetSlotId: SOURCE_SLOT_ID,
          }),
        }),
      ])
    );
  });

  it('fires on the first positive 60 fps delta and only strictly after each 5 second threshold', () => {
    const harness = runPeriodicRuntime({
      scenarioOptions: {
        durationMs: 10020,
        actorCurrentHp: 1000,
      },
      targetKinds: ['actor'],
    });
    const events = periodicEvents(harness.runtime);

    expect(events.map(event => event.payload.tickIndex)).toEqual([0, 1, 2]);
    // the first tick fires on the first positive 60 fps delta, never at frame zero
    expect(events[0].payload.frameIndex).toBe(1);
    expect(events[0].payload.thresholdMs).toBe(0);
    // every threshold advances by one full periodic interval per tick
    for (let i = 1; i < events.length; i += 1) {
      expect(events[i].payload.thresholdMs).toBeGreaterThan(
        events[i - 1].payload.thresholdMs
      );
      // 相对契约：tick 结算时间严格递增（零推进/停滞实现不得通过）
      expect(events[i].timeMs).toBeGreaterThan(events[i - 1].timeMs);
    }
    // 相对契约：每个 tick 都是真实治疗，数量>0、HP 确实上升、前后值守恒
    for (const event of events) {
      expect(event.payload.requestedChange).toBeGreaterThan(0);
      expect(event.payload.change).toBeGreaterThan(0);
      expect(event.payload.afterValue).toBeGreaterThan(
        event.payload.beforeValue
      );
      expect(event.payload.afterValue).toBe(
        event.payload.beforeValue + event.payload.change
      );
    }
    // every tick fires on the first frame strictly after its own threshold
    expectPeriodicTickFrames(events, harness.scenario.time.fps);
  });

  it('keeps Actor and Kibo HP separate when both use the owner actor id, and applies source/target heal modifiers before missing-HP clamp', () => {
    const { runtime } = runPeriodicRuntime({
      scenarioOptions: {
        actorCurrentHp: 4900,
        kiboCurrentHp: 1000,
        sourceShootHealUpRaw: 1000,
        actorSufferHealUpRaw: 2000,
        kiboSufferHealUpRaw: 0,
      },
    });
    const actorEvent = findPeriodicEvent(runtime, 'actor', SOURCE_ACTOR_ID);
    const kiboEvent = findPeriodicEvent(runtime, 'kibo', SOURCE_ACTOR_ID);

    expect(actorEvent).toMatchObject({
      type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL',
      targetId: SOURCE_ACTOR_ID,
      payload: {
        targetKind: 'actor',
        sourceMaxHp: 10000,
        sourceShootHealUpRaw: 1000,
        targetSufferHealUpRaw: 2000,
        requestedChange: expect.any(Number),
        beforeValue: 4900,
        change: expect.any(Number),
        afterValue: expect.any(Number),
        maxValue: 5000,
        overheal: expect.any(Number),
      },
    });
    // source/target heal-up modifiers feed the requested heal, then the
    // missing-HP clamp caps the applied change at maxValue
    expect(actorEvent.payload.overheal).toBe(
      Math.max(
        0,
        actorEvent.payload.requestedChange - actorEvent.payload.change
      )
    );
    expect(actorEvent.payload.change).toBe(
      actorEvent.payload.afterValue - actorEvent.payload.beforeValue
    );
    expect(actorEvent.payload.afterValue).toBeLessThanOrEqual(
      actorEvent.payload.maxValue
    );
    // 相对契约：真实治疗必须 requestedChange>0、change>0、HP 确实上升且前后值守恒
    expect(actorEvent.payload.requestedChange).toBeGreaterThan(0);
    expect(actorEvent.payload.change).toBeGreaterThan(0);
    expect(actorEvent.payload.afterValue).toBeGreaterThan(
      actorEvent.payload.beforeValue
    );
    expect(actorEvent.payload.afterValue).toBe(
      actorEvent.payload.beforeValue + actorEvent.payload.change
    );
    // 缺血钳制：HP 回到满血，change 被 maxValue 截断，overheal 为正
    expect(actorEvent.payload.afterValue).toBe(actorEvent.payload.maxValue);
    expect(actorEvent.payload.overheal).toBeGreaterThan(0);
    expect(kiboEvent).toMatchObject({
      type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL',
      targetId: SOURCE_ACTOR_ID,
      payload: {
        targetKind: 'kibo',
        targetSlotId: SOURCE_SLOT_ID,
        targetKiboId: SOURCE_KIBO_ID,
        sourceMaxHp: 10000,
        sourceShootHealUpRaw: 1000,
        targetSufferHealUpRaw: 0,
        requestedChange: expect.any(Number),
        beforeValue: 1000,
        change: expect.any(Number),
        afterValue: expect.any(Number),
        maxValue: 10000,
        overheal: expect.any(Number),
      },
    });
    expect(kiboEvent.payload.overheal).toBe(
      Math.max(0, kiboEvent.payload.requestedChange - kiboEvent.payload.change)
    );
    expect(kiboEvent.payload.change).toBe(
      kiboEvent.payload.afterValue - kiboEvent.payload.beforeValue
    );
    expect(kiboEvent.payload.afterValue).toBeLessThanOrEqual(
      kiboEvent.payload.maxValue
    );
    // 相对契约：真实治疗必须 requestedChange>0、change>0、HP 确实上升且前后值守恒
    expect(kiboEvent.payload.requestedChange).toBeGreaterThan(0);
    expect(kiboEvent.payload.change).toBeGreaterThan(0);
    expect(kiboEvent.payload.afterValue).toBeGreaterThan(
      kiboEvent.payload.beforeValue
    );
    expect(kiboEvent.payload.afterValue).toBe(
      kiboEvent.payload.beforeValue + kiboEvent.payload.change
    );
    // 未触发钳制：change 全额应用、overheal 为 0
    expect(kiboEvent.payload.overheal).toBe(0);
    expect(kiboEvent.payload.change).toBe(kiboEvent.payload.requestedChange);
    expect(runtime.finalState.actorVitals).toContainEqual(
      expect.objectContaining({
        actorId: SOURCE_ACTOR_ID,
        currentHp: expect.any(Number),
        maximumHp: 5000,
      })
    );
    expect(runtime.finalState.kiboVitals).toContainEqual(
      expect.objectContaining({
        actorId: SOURCE_ACTOR_ID,
        kiboId: SOURCE_KIBO_ID,
        currentHp: expect.any(Number),
        maximumHp: 10000,
      })
    );
    // 相对契约：终态 HP 与治疗事件的 afterValue 守恒（治疗未落盘实现不得通过）
    expect(
      runtime.finalState.actorVitals.find(
        vital => vital.actorId === SOURCE_ACTOR_ID
      ).currentHp
    ).toBe(actorEvent.payload.afterValue);
    expect(
      runtime.finalState.kiboVitals.find(
        vital => vital.kiboId === SOURCE_KIBO_ID
      ).currentHp
    ).toBe(kiboEvent.payload.afterValue);
  });

  it('consumes full-health and dead-target ticks without changing either HP pool', () => {
    const { runtime } = runPeriodicRuntime({
      scenarioOptions: {
        actorCurrentHp: 5000,
        kiboCurrentHp: 0,
      },
    });
    const actorEvent = findPeriodicEvent(runtime, 'actor', SOURCE_ACTOR_ID);
    const kiboEvent = findPeriodicEvent(runtime, 'kibo', SOURCE_ACTOR_ID);

    expect(actorEvent).toMatchObject({
      type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED',
      payload: {
        reason: 'periodic-heal-target-current-hp-ratio-not-below-one',
        beforeValue: 5000,
        change: 0,
        afterValue: 5000,
        conditionMatched: false,
      },
    });
    expect(kiboEvent).toMatchObject({
      type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED',
      payload: {
        reason: 'periodic-heal-dead-target-before-execute-rejected',
        beforeValue: 0,
        change: 0,
        afterValue: 0,
        conditionMatched: true,
      },
    });
  });

  it('uses a +60% Kibo MAXHP effect exactly once for Heal104 and inherited max snapshots', () => {
    const { runtime } = runPeriodicRuntime({
      scenarioOptions: {
        actorCurrentHp: 1000,
        kiboCurrentHp: 1000,
        inheritedKiboMaxHp: 16000,
      },
      targetKinds: ['actor'],
      extraEffectCommands: [createKiboMaxHpSixtyPercentCommand()],
    });
    const event = findPeriodicEvent(runtime, 'actor', SOURCE_ACTOR_ID);

    expect(event.type).toBe('VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL');
    expect(event.payload.sourceMaxHp).toBeCloseTo(15999.908447, 6);
    expect(event.payload.requestedChange).toEqual(expect.any(Number));
    // 相对契约：真实治疗必须 requestedChange>0、change>0、HP 确实上升且前后值守恒
    expect(event.payload.requestedChange).toBeGreaterThan(0);
    expect(event.payload.change).toBeGreaterThan(0);
    expect(event.payload.afterValue).toBeGreaterThan(event.payload.beforeValue);
    expect(event.payload.afterValue).toBe(
      event.payload.beforeValue + event.payload.change
    );
    const initialKiboVital = runtime.initialState.kiboVitals.find(
      vital => vital.actorId === SOURCE_ACTOR_ID
    );
    expect(initialKiboVital).toMatchObject({
      baseMaximumHp: 10000,
      inheritedMaximumHpSnapshot: 16000,
    });
    expect(initialKiboVital.maximumHp).toBeCloseTo(15999.908447, 6);
    const finalKiboVital = runtime.finalState.kiboVitals.find(
      vital => vital.actorId === SOURCE_ACTOR_ID
    );
    expect(finalKiboVital.maximumHp).toBeCloseTo(15999.908447, 6);
  });

  it('emits an explicit suppressed event when the periodic root is inactive', () => {
    const { runtime } = runPeriodicRuntime({
      targetKinds: ['actor'],
      includeRoot: false,
    });

    expect(findPeriodicEvent(runtime, 'actor', SOURCE_ACTOR_ID)).toMatchObject({
      type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED',
      payload: {
        reason: 'periodic-heal-root-effect-inactive',
        targetKind: 'actor',
        tickIndex: 0,
        frameIndex: 1,
      },
    });
  });

  it('retains periodic source, target, tick, formula and contributor fields in the canonical trace', () => {
    const harness = runPeriodicRuntime({
      scenarioOptions: {
        actorCurrentHp: 1000,
        sourceShootHealUpRaw: 1000,
        actorSufferHealUpRaw: 2000,
      },
      targetKinds: ['actor'],
    });
    const trace = createCanonicalTrace(harness);
    const event = trace.events.find(
      item => item.type === 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL'
    );

    expect(event).toMatchObject({
      actorId: SOURCE_ACTOR_ID,
      targetId: SOURCE_ACTOR_ID,
      payload: {
        passiveSkillId: PERIODIC_SKILL_ID,
        rootElementId: ROOT_ELEMENT_ID,
        healElementId: HEAL_ELEMENT_ID,
        targetKind: 'actor',
        targetActorId: SOURCE_ACTOR_ID,
        targetSlotId: SOURCE_SLOT_ID,
        sourceActorId: SOURCE_ACTOR_ID,
        sourceKiboId: SOURCE_KIBO_ID,
        sourceSlotId: SOURCE_SLOT_ID,
        frameIndex: 1,
        tickIndex: 0,
        thresholdMs: 0,
        requestedChange: expect.any(Number),
        change: expect.any(Number),
        maxValue: 5000,
        contributingSources: [
          expect.objectContaining({
            sourceActorId: SOURCE_ACTOR_ID,
            sourceKiboId: SOURCE_KIBO_ID,
            sourceSlotId: SOURCE_SLOT_ID,
          }),
        ],
        formulaSource: expect.objectContaining({
          targetKind: 'kibo',
          targetId: SOURCE_ACTOR_ID,
          targetKiboId: SOURCE_KIBO_ID,
        }),
        sourceIdentity: expect.objectContaining({
          passiveSkillId: PERIODIC_SKILL_ID,
          kiboId: SOURCE_KIBO_ID,
          sourceSlotId: SOURCE_SLOT_ID,
          finalTargetKind: 'actor',
        }),
      },
    });
    // 相对契约：canonical trace 中的真实治疗必须 requestedChange>0、change>0、
    // HP 确实上升且前后值守恒（零治疗实现不得通过）
    expect(event.payload.requestedChange).toBeGreaterThan(0);
    expect(event.payload.change).toBeGreaterThan(0);
    expect(event.payload.afterValue).toBeGreaterThan(event.payload.beforeValue);
    expect(event.payload.afterValue).toBe(
      event.payload.beforeValue + event.payload.change
    );
  });

  it('keeps periodic event ordering deterministic when scenario actor storage order changes', () => {
    const first = runPeriodicRuntime({
      scenarioOptions: {
        includeOtherActor: true,
        actorOrder: [SOURCE_ACTOR_ID, OTHER_ACTOR_ID],
      },
    }).runtime;
    const reordered = runPeriodicRuntime({
      scenarioOptions: {
        includeOtherActor: true,
        actorOrder: [OTHER_ACTOR_ID, SOURCE_ACTOR_ID],
      },
    }).runtime;

    expect(periodicEventIdentities(reordered)).toEqual(
      periodicEventIdentities(first)
    );
  });

  it('keeps an equipped source active in the background and projects only concrete sparse-team holders', () => {
    const scenario = createPeriodicScenario({
      includeOtherActor: true,
      controlledActorId: OTHER_ACTOR_ID,
    });
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
    });

    expect(generation.unresolved).toEqual([]);
    expect(generation.periodicVitalSchedules).toHaveLength(3);
    expect(
      generation.periodicVitalSchedules.map(schedule => [
        schedule.targetKind,
        schedule.targetId,
        schedule.sourceActorId,
      ])
    ).toEqual([
      ['actor', SOURCE_ACTOR_ID, SOURCE_ACTOR_ID],
      ['kibo', SOURCE_ACTOR_ID, SOURCE_ACTOR_ID],
      ['actor', OTHER_ACTOR_ID, SOURCE_ACTOR_ID],
    ]);

    const withoutSource = createVerifiedKiboPassiveGeneration({
      scenario: createPeriodicScenario({ includeSourceKibo: false }),
    });
    expect(withoutSource.effectCommands).toEqual([]);
    expect(withoutSource.periodicVitalSchedules).toEqual([]);
  });

  it('rejects missing source slots, topology mismatches and unidentified projected holders', () => {
    const missingSourceSlot = createPeriodicScenario();
    missingSourceSlot.team.slots = [];
    const missingSourceGeneration = createVerifiedKiboPassiveGeneration({
      scenario: missingSourceSlot,
    });
    expect(missingSourceGeneration.effectCommands).toEqual([]);
    expect(missingSourceGeneration.periodicVitalSchedules).toEqual([]);
    expect(missingSourceGeneration.unresolved).toContainEqual(
      expect.objectContaining({
        skillId: PERIODIC_SKILL_ID,
        reasons: ['periodic-heal-source-slot-identity-unresolved'],
      })
    );

    const mismatchedTopology = createPeriodicScenario();
    mismatchedTopology.sourceProject.metadata.timelineTopology.actorGroups[0].kiboLane.kiboId =
      OTHER_SOURCE_KIBO_ID;
    const mismatchGeneration = createVerifiedKiboPassiveGeneration({
      scenario: mismatchedTopology,
    });
    expect(mismatchGeneration.periodicVitalSchedules).toEqual([]);
    expect(mismatchGeneration.unresolved).toContainEqual(
      expect.objectContaining({
        reasons: ['periodic-heal-source-loadout-topology-mismatch'],
      })
    );

    const unidentifiedHolder = createPeriodicScenario({
      includeOtherActor: true,
    });
    unidentifiedHolder.team.slots = unidentifiedHolder.team.slots.filter(
      slot => slot.actorId !== OTHER_ACTOR_ID
    );
    const holderGeneration = createVerifiedKiboPassiveGeneration({
      scenario: unidentifiedHolder,
    });
    expect(
      holderGeneration.periodicVitalSchedules.some(
        schedule => schedule.targetId === OTHER_ACTOR_ID
      )
    ).toBe(false);
    expect(holderGeneration.unresolved).toContainEqual(
      expect.objectContaining({
        targetKind: 'actor',
        targetId: OTHER_ACTOR_ID,
        reasons: ['periodic-heal-team-target-slot-identity-unresolved'],
      })
    );
  });

  it('keeps duplicate Cover sources numerically single but suppresses healing until native first-survivor order is proven', () => {
    const harness = runPeriodicRuntime({
      scenarioOptions: {
        includeOtherActor: true,
        otherKiboId: OTHER_SOURCE_KIBO_ID,
      },
      targetKinds: ['actor'],
    });
    const schedule = harness.generation.periodicVitalSchedules.find(
      row => row.targetKind === 'actor' && row.targetId === SOURCE_ACTOR_ID
    );

    expect(schedule).toMatchObject({
      sourceActorId: null,
      sourceKiboId: null,
      sourceAttributionStatus: 'native-cover-survivor-order-unresolved',
      sourceSelectionPolicy:
        'all-contributors-retained-native-cover-first-survivor-unresolved',
      formulaSource: null,
      contributingSources: [
        expect.objectContaining({ sourceActorId: SOURCE_ACTOR_ID }),
        expect.objectContaining({ sourceActorId: OTHER_ACTOR_ID }),
      ],
    });
    expect(harness.generation.status).toBe(
      'verified-kibo-passive-generation-ready-with-explicit-gaps'
    );
    expect(harness.generation.unresolved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: PERIODIC_SKILL_ID,
          targetKind: 'actor',
          targetId: SOURCE_ACTOR_ID,
          reasons: ['periodic-heal-native-cover-survivor-order-unresolved'],
        }),
        expect.objectContaining({
          skillId: PERIODIC_SKILL_ID,
          targetKind: 'actor',
          targetId: OTHER_ACTOR_ID,
        }),
      ])
    );
    expect(
      harness.generation.effectCommands.filter(
        command =>
          command.targetKind === 'actor' && command.targetId === SOURCE_ACTOR_ID
      )
    ).toHaveLength(1);
    expect(
      findPeriodicEvent(harness.runtime, 'actor', SOURCE_ACTOR_ID)
    ).toMatchObject({
      type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED',
      payload: {
        reason: 'periodic-heal-native-cover-survivor-order-unresolved',
        appliedToCalculators: false,
      },
    });
  });

  it('blocks cycle restart instead of resetting the native root phase to a false first-frame tick', () => {
    const scenario = createPeriodicScenario({
      boundarySource: {
        sourceScenarioId: 'before-boundary',
        boundaryId: 'cycle-boundary-3000',
        boundaryTimeMs: 3000,
      },
    });
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
    });

    expect(generation.effectCommands).toEqual([]);
    expect(generation.periodicVitalSchedules).toEqual([]);
    expect(generation.unresolved).toContainEqual(
      expect.objectContaining({
        skillId: PERIODIC_SKILL_ID,
        reasons: ['periodic-heal-cycle-trigger-phase-inheritance-unresolved'],
        evidence: expect.objectContaining({
          boundaryId: 'cycle-boundary-3000',
          boundaryTimeMs: 3000,
        }),
      })
    );
  });

  it('emits a structured event for a malformed periodic schedule instead of silently dropping it', () => {
    const { runtime } = runPeriodicRuntime({
      targetKinds: ['actor'],
      scheduleTransform: schedule => ({
        ...schedule,
        trigger: { ...schedule.trigger, intervalMs: 0 },
      }),
    });

    expect(runtime.vitalEvents).toContainEqual(
      expect.objectContaining({
        type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED',
        timeMs: 0,
        payload: expect.objectContaining({
          reason: 'periodic-heal-schedule-contract-unresolved',
          unresolvedReasons: ['periodic-heal-trigger-interval-invalid'],
          appliedToCalculators: false,
        }),
      })
    );
  });

  it.each([
    [
      'condition',
      schedule => ({
        ...schedule,
        condition: { ...schedule.condition, operator: 'less-than-or-equal' },
      }),
      'periodic-heal-condition-contract-invalid',
    ],
    [
      'formula',
      schedule => ({
        ...schedule,
        heal: {
          ...schedule.heal,
          formula: { ...schedule.heal.formula, baseFunctionId: 105 },
        },
      }),
      'periodic-heal-formula-contract-invalid',
    ],
    [
      'lifecycle',
      schedule => ({
        ...schedule,
        heal: {
          ...schedule.heal,
          outputClamp: 'unverified-clamp',
          healModifierAttributes: {
            ...schedule.heal.healModifierAttributes,
            sourceAttributeId: 25,
          },
        },
      }),
      'periodic-heal-lifecycle-or-modifier-contract-invalid',
    ],
  ])(
    'rejects a shape-valid but unverified %s contract mutation',
    (_label, scheduleTransform, expectedReason) => {
      const { runtime } = runPeriodicRuntime({
        targetKinds: ['actor'],
        scheduleTransform,
      });
      expect(runtime.vitalEvents).toContainEqual(
        expect.objectContaining({
          type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED',
          timeMs: 0,
          payload: expect.objectContaining({
            reason: 'periodic-heal-schedule-contract-unresolved',
            unresolvedReasons: expect.arrayContaining([expectedReason]),
            appliedToCalculators: false,
          }),
        })
      );
    }
  );

  it('suppresses a same-frame passive heal when friendly HP mutation order is not native-verified', () => {
    const harness = runPeriodicRuntime({
      targetKinds: ['actor'],
      directHpEvents: [
        {
          timeMs: 16.666667,
          action: null,
          actionId: null,
          actorId: SOURCE_ACTOR_ID,
          target: { kind: 'actor', id: SOURCE_ACTOR_ID },
          value: 100,
          applied: true,
          sourceSequencePath: [Number.MAX_SAFE_INTEGER, 2, 1],
          effect: { effectIdentity: 'test-direct-heal' },
          sourceIdentity: { identity: 'test-direct-heal' },
        },
      ],
    });
    const { runtime } = harness;

    expect(findPeriodicEvent(runtime, 'actor', SOURCE_ACTOR_ID)).toMatchObject({
      type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED',
      payload: {
        reason: 'periodic-heal-same-time-vital-order-unresolved',
        appliedToCalculators: false,
        sameTimeVitalOrderConflict: {
          reason: 'same-time-friendly-hp-mutation-native-order-unresolved',
          descriptorCount: 2,
          descriptorKinds: ['direct-heal', 'passive-periodic-heal'],
        },
      },
    });
    expect(runtime.vitalEvents).toContainEqual(
      expect.objectContaining({
        type: 'VERIFIED_DIRECT_HEAL',
        payload: expect.objectContaining({ change: 100 }),
      })
    );
    const canonicalConflict = createCanonicalTrace(harness).events.find(
      event => event.type === 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED'
    );
    expect(canonicalConflict.payload).toMatchObject({
      reason: 'periodic-heal-same-time-vital-order-unresolved',
      sameTimeVitalOrderConflict: {
        descriptorKinds: ['direct-heal', 'passive-periodic-heal'],
      },
    });
  });

  it('consumes a failed full-health period and waits for the next strict threshold after MAXHP increases', () => {
    const harness = runPeriodicRuntime({
      scenarioOptions: {
        durationMs: 5020,
        actorCurrentHp: 5000,
      },
      targetKinds: ['actor'],
      extraEffectCommands: [createActorMaxHpTwentyPercentCommand()],
    });
    const events = periodicEvents(harness.runtime);

    // one failed full-health tick at the first frame, then one applied tick at
    // the next strict threshold after the MAXHP increase
    expect(events.map(event => event.payload.tickIndex)).toEqual([0, 1]);
    expectPeriodicTickFrames(events, harness.scenario.time.fps);
    expect(events[0]).toMatchObject({
      type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED',
      payload: {
        reason: 'periodic-heal-target-current-hp-ratio-not-below-one',
        tickIndex: 0,
      },
    });
    expect(events[1]).toMatchObject({
      type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL',
      payload: {
        reason: 'periodic-heal-applied',
        tickIndex: 1,
        beforeValue: 5000,
      },
    });
    expect(events[1].payload.maxValue).toBeCloseTo(5999.984741, 6);
    // 相对契约：失败 full-health tick 之后，MAXHP 提高的下一个严格阈值 tick
    // 必须是真实治疗：时间严格递增、change>0、HP 确实上升、前后值守恒
    expect(events[0].timeMs).toBeLessThan(events[1].timeMs);
    expect(events[1].payload.requestedChange).toBeGreaterThan(0);
    expect(events[1].payload.change).toBeGreaterThan(0);
    expect(events[1].payload.afterValue).toBeGreaterThan(
      events[1].payload.beforeValue
    );
    expect(events[1].payload.afterValue).toBe(
      events[1].payload.beforeValue + events[1].payload.change
    );
  });

  it('stops later ticks after the persistent root is explicitly removed', () => {
    const harness = runPeriodicRuntime({
      scenarioOptions: { durationMs: 5020 },
      targetKinds: ['actor'],
      extraEffectCommands: [createPeriodicActorRootRemoveCommand()],
    });
    const events = periodicEvents(harness.runtime);

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL');
    expect(events[1]).toMatchObject({
      type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED',
      payload: {
        tickIndex: 1,
        reason: 'periodic-heal-root-effect-inactive',
      },
    });
    // the later tick still fires strictly after the first one before stopping
    expect(events[0].timeMs).toBeLessThan(events[1].timeMs);
    expectPeriodicTickFrames(events, harness.scenario.time.fps);
    // 相对契约：被移除前的首个 tick 必须是真实治疗：change>0、HP 确实上升、
    // 前后值守恒（零治疗实现不得通过）
    expect(events[0].payload.requestedChange).toBeGreaterThan(0);
    expect(events[0].payload.change).toBeGreaterThan(0);
    expect(events[0].payload.afterValue).toBeGreaterThan(
      events[0].payload.beforeValue
    );
    expect(events[0].payload.afterValue).toBe(
      events[0].payload.beforeValue + events[0].payload.change
    );
  });

  it('does not schedule a later threshold after the battle duration ends', () => {
    const harness = runPeriodicRuntime({
      scenarioOptions: { durationMs: 5000 },
      targetKinds: ['actor'],
    });
    const events = periodicEvents(harness.runtime);

    // only the first positive-delta tick exists; the next threshold tick would
    // land strictly after the battle duration, so it is never scheduled
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL',
      payload: {
        tickIndex: 0,
        frameIndex: 1,
        thresholdMs: 0,
      },
    });
    expectPeriodicTickFrames(events, harness.scenario.time.fps);
    // 相对契约：唯一 tick 必须是真实治疗：change>0、HP 确实上升、前后值守恒
    expect(events[0].payload.requestedChange).toBeGreaterThan(0);
    expect(events[0].payload.change).toBeGreaterThan(0);
    expect(events[0].payload.afterValue).toBeGreaterThan(
      events[0].payload.beforeValue
    );
    expect(events[0].payload.afterValue).toBe(
      events[0].payload.beforeValue + events[0].payload.change
    );
  });
});

function runPeriodicRuntime({
  scenarioOptions = {},
  targetKinds = ['actor', 'kibo'],
  includeRoot = true,
  extraEffectCommands = [],
  directHpEvents = [],
  scheduleTransform = schedule => schedule,
} = {}) {
  const scenario = createPeriodicScenario(scenarioOptions);
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
  });
  const selectedSchedules = generation.periodicVitalSchedules
    .filter(schedule => targetKinds.includes(schedule.targetKind))
    .map(scheduleTransform);
  const selectedTargetKeys = new Set(
    selectedSchedules.map(
      schedule => `${schedule.targetKind}|${schedule.targetId}`
    )
  );
  const periodicRootCommands = includeRoot
    ? generation.effectCommands.filter(command =>
        selectedTargetKeys.has(`${command.targetKind}|${command.targetId}`)
      )
    : [];
  const effectTimeline = createEffectRuntimeTimeline({
    scenario,
    actionExecutionPlan,
    controlledActorTimeline,
    generatedCommands: [...periodicRootCommands, ...extraEffectCommands],
  });
  const kiboPassiveGeneration = {
    ...generation,
    effectCommands: periodicRootCommands,
    periodicVitalSchedules: selectedSchedules,
  };
  const runtime = createVerifiedCombatRuntime({
    scenario,
    actionExecutionPlan,
    controlledActorTimeline,
    effectTimeline,
    effectGeneration: { directHpEvents },
    kiboPassiveGeneration,
  });
  return {
    scenario,
    actionRuleDiagnostics,
    actionExecutionPlan,
    controlledActorTimeline,
    effectTimeline,
    generation,
    kiboPassiveGeneration,
    runtime,
  };
}

function createPeriodicScenario({
  durationMs = 20,
  includeOtherActor = false,
  actorOrder = [SOURCE_ACTOR_ID, OTHER_ACTOR_ID],
  actorCurrentHp = 1000,
  kiboCurrentHp = 1000,
  otherActorCurrentHp = 1000,
  actorMaxHp = 5000,
  kiboMaxHp = 10000,
  otherActorMaxHp = 4000,
  sourceShootHealUpRaw = 0,
  actorSufferHealUpRaw = 0,
  kiboSufferHealUpRaw = 0,
  inheritedKiboMaxHp = kiboMaxHp,
  includeSourceKibo = true,
  otherKiboId = null,
  otherKiboCurrentHp = 1000,
  otherKiboMaxHp = 8000,
  controlledActorId = null,
  boundarySource = null,
} = {}) {
  const sourceActor = createActor({
    id: SOURCE_ACTOR_ID,
    characterId: 101007,
    name: '来源角色',
    maxHp: actorMaxHp,
    sufferHealUpRaw: actorSufferHealUpRaw,
    kiboId: includeSourceKibo ? SOURCE_KIBO_ID : null,
    kiboMaxHp,
    kiboShootHealUpRaw: sourceShootHealUpRaw,
    kiboSufferHealUpRaw,
  });
  const otherActor = createActor({
    id: OTHER_ACTOR_ID,
    characterId: 109001,
    name: '第二角色',
    maxHp: otherActorMaxHp,
    sufferHealUpRaw: 0,
    kiboId: otherKiboId,
    kiboMaxHp: otherKiboMaxHp,
  });
  const actorById = new Map([
    [SOURCE_ACTOR_ID, sourceActor],
    [OTHER_ACTOR_ID, otherActor],
  ]);
  const includedIds = includeOtherActor
    ? actorOrder
    : actorOrder.filter(id => id === SOURCE_ACTOR_ID);
  const actors = includedIds.map(id => actorById.get(id));
  const teamSlots = [
    {
      id: SOURCE_SLOT_ID,
      slotId: SOURCE_SLOT_ID,
      actorId: SOURCE_ACTOR_ID,
      characterId: sourceActor.characterId,
      position: 0,
      kiboId: sourceActor.loadout.kiboId,
    },
    ...(includeOtherActor
      ? [
          {
            id: 'team-slot-2',
            slotId: 'team-slot-2',
            actorId: OTHER_ACTOR_ID,
            characterId: otherActor.characterId,
            position: 1,
            kiboId: otherActor.loadout.kiboId,
          },
        ]
      : []),
  ];
  return {
    id: 'verified-kibo-periodic-heal-fixture',
    projectId: 'verified-kibo-periodic-heal-fixture',
    projectName: 'K1-A13 周期治疗测试',
    mechanicsProfile: {
      profileId: VERIFIED_PROFILE_ID,
    },
    time: {
      durationMs,
      fps: 60,
    },
    actors,
    team: {
      slots: teamSlots,
    },
    actions: [],
    enemy: {
      id: 300032,
      enemyId: 300032,
      stats: {
        maxHp: 100000,
        initialToughness: 1000,
        maxToughness: 1000,
      },
    },
    combatScenario: {
      projectile: {
        targetDistance: 0,
        defaultWillHit: true,
      },
      critical: {
        policy: 'non-critical',
      },
    },
    initialRuntimeState: {
      schemaVersion: 7,
      ...(boundarySource ? { source: boundarySource } : {}),
      ...(controlledActorId
        ? {
            controlledActor: {
              actorId: controlledActorId,
              characterId: actorById.get(controlledActorId)?.characterId,
            },
          }
        : {}),
      actorVitalsByActor: [
        {
          actorId: SOURCE_ACTOR_ID,
          characterId: sourceActor.characterId,
          currentValue: actorCurrentHp,
          maxValue: actorMaxHp,
          valueShields: [],
        },
        ...(includeOtherActor
          ? [
              {
                actorId: OTHER_ACTOR_ID,
                characterId: otherActor.characterId,
                currentValue: otherActorCurrentHp,
                maxValue: otherActorMaxHp,
                valueShields: [],
              },
            ]
          : []),
      ],
      kiboVitalsBySlot: [
        ...(includeSourceKibo
          ? [
              {
                slotId: SOURCE_SLOT_ID,
                actorId: SOURCE_ACTOR_ID,
                characterId: sourceActor.characterId,
                kiboId: SOURCE_KIBO_ID,
                currentValue: kiboCurrentHp,
                maxValue: inheritedKiboMaxHp,
                valueShields: [],
              },
            ]
          : []),
        ...(includeOtherActor && otherKiboId != null
          ? [
              {
                slotId: 'team-slot-2',
                actorId: OTHER_ACTOR_ID,
                characterId: otherActor.characterId,
                kiboId: otherKiboId,
                currentValue: otherKiboCurrentHp,
                maxValue: otherKiboMaxHp,
                valueShields: [],
              },
            ]
          : []),
      ],
    },
    sourceProject: {
      metadata: {
        timelineTopology: {
          actorGroups: teamSlots.map(slot => ({
            slotId: slot.slotId,
            actorId: slot.actorId,
            kiboLane: {
              kiboId: slot.kiboId,
            },
          })),
        },
      },
    },
  };
}

function createActor({
  id,
  characterId,
  name,
  maxHp,
  sufferHealUpRaw,
  kiboId,
  kiboMaxHp = null,
  kiboShootHealUpRaw = 0,
  kiboSufferHealUpRaw = 0,
}) {
  return {
    id,
    characterId,
    name,
    elementId: 0,
    stats: {
      maxHp,
      maxSp: 100,
    },
    loadout: {
      kiboId,
    },
    verifiedStaticProperties: {
      ready: true,
      attributes: [
        { id: 5, rawValue: maxHp },
        { id: 23, rawValue: 0 },
        { id: 24, rawValue: sufferHealUpRaw },
      ],
      resourceProfile: {
        maxSp: 100,
        effectiveMaxSp: 100,
      },
    },
    ...(kiboId == null
      ? {}
      : {
          verifiedStaticKiboProperties: {
            ready: true,
            kiboId,
            attributes: [
              { id: 5, rawValue: kiboMaxHp },
              { id: 23, rawValue: kiboShootHealUpRaw },
              { id: 24, rawValue: kiboSufferHealUpRaw },
            ],
            stats: {
              attack: 100,
            },
            resourceProfile: {
              maxSp: 100,
              effectiveMaxSp: 100,
            },
            sourceIdentity: 'test-only-static-kibo',
          },
        }),
  };
}

function createKiboMaxHpSixtyPercentCommand() {
  return {
    id: 'test-only-520043-kibo-max-hp',
    sourceActionId: null,
    sourceActorId: SOURCE_ACTOR_ID,
    sourceKiboId: SOURCE_KIBO_ID,
    effectId: 'kibo-passive:520043:520043001',
    effectName: '茁壮植株',
    operation: 'apply',
    targetKind: 'kibo',
    targetId: SOURCE_ACTOR_ID,
    semanticTargetKind: 'kibo',
    timeMs: 0,
    durationMs: null,
    stackMode: 'replace',
    stackDelta: 1,
    maxStacks: 1,
    tags: ['kibo-passive', 'skill:520043'],
    sourceStatus: 'verified-passive-effect-generated',
    generatedVerified: true,
    appliedToCalculators: true,
    modifiers: [
      {
        kind: 'battle-property',
        attributeId: 5,
        bucket: 'dynamicPercent',
        valueRaw: 6000,
        sourceElementId: 520043001,
      },
    ],
    sourceIdentity: {
      packageId: 'test-only-kibo-periodic-heal-catalog',
      passiveSkillId: 520043,
      kiboId: SOURCE_KIBO_ID,
      effectElementId: 520043001,
    },
  };
}

function createActorMaxHpTwentyPercentCommand() {
  return {
    id: 'test-only-actor-max-hp-increase',
    sourceActionId: null,
    sourceActorId: SOURCE_ACTOR_ID,
    effectId: 'test-only-actor-max-hp-increase',
    effectName: '测试最大生命提高',
    operation: 'apply',
    targetKind: 'actor',
    targetId: SOURCE_ACTOR_ID,
    semanticTargetKind: 'actor',
    timeMs: 1000,
    durationMs: null,
    stackMode: 'replace',
    stackDelta: 1,
    maxStacks: 1,
    tags: ['test-only'],
    sourceStatus: 'verified-passive-effect-generated',
    generatedVerified: true,
    appliedToCalculators: true,
    modifiers: [
      {
        kind: 'battle-property',
        attributeId: 5,
        bucket: 'dynamicPercent',
        valueRaw: 2000,
      },
    ],
    sourceIdentity: {
      packageId: 'test-only-kibo-periodic-heal-catalog',
      actionBindingIdentity: 'test-only-actor-max-hp-increase',
      effectIdentity: 'test-only-actor-max-hp-increase',
    },
  };
}

function createPeriodicActorRootRemoveCommand() {
  return {
    id: 'test-only-remove-periodic-root',
    sourceActionId: null,
    sourceActorId: SOURCE_ACTOR_ID,
    effectId: `kibo-passive:${PERIODIC_SKILL_ID}:${ROOT_ELEMENT_ID}`,
    effectName: '移除周期治疗根',
    operation: 'remove',
    targetKind: 'actor',
    targetId: SOURCE_ACTOR_ID,
    semanticTargetKind: 'actor',
    timeMs: 1000,
    durationMs: null,
    stackMode: 'replace',
    stackDelta: 1,
    maxStacks: 1,
    tags: ['test-only'],
    sourceStatus: 'verified-passive-effect-generated',
    generatedVerified: true,
    appliedToCalculators: false,
    modifiers: [],
    sourceIdentity: {
      packageId: 'test-only-kibo-periodic-heal-catalog',
      actionBindingIdentity: 'test-only-remove-periodic-root',
      effectIdentity: `kibo-passive:${PERIODIC_SKILL_ID}:${ROOT_ELEMENT_ID}`,
    },
  };
}

function expectPeriodicTickFrames(events, fps) {
  for (const event of events) {
    // right-open boundary: each tick fires on the first fps frame strictly
    // after its own elapsed threshold
    expect(event.payload.frameIndex).toBe(
      Math.floor((event.payload.thresholdMs * fps) / 1000) + 1
    );
    expect(event.timeMs).toBeGreaterThan(event.payload.thresholdMs);
  }
}

function periodicEvents(runtime) {
  return runtime.vitalEvents.filter(event =>
    [
      'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL',
      'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED',
    ].includes(event.type)
  );
}

function findPeriodicEvent(runtime, targetKind, targetId) {
  return periodicEvents(runtime).find(
    event =>
      event.targetId === targetId && event.payload.targetKind === targetKind
  );
}

function periodicEventIdentities(runtime) {
  return periodicEvents(runtime).map(
    event =>
      `${event.timeMs}|${event.payload.passiveSkillId}|${event.payload.targetKind}|${event.targetId}|${event.payload.tickIndex}`
  );
}

function createCanonicalTrace({
  scenario,
  actionRuleDiagnostics,
  actionExecutionPlan,
  controlledActorTimeline,
  effectTimeline,
  runtime,
}) {
  return createCanonicalCombatTrace({
    compilation: {
      scenario,
      dataIdentity: {
        kind: 'test-only-kibo-periodic-heal-data',
      },
    },
    simulation: {
      scenario: {
        projectId: scenario.projectId,
        projectName: scenario.projectName,
        durationMs: scenario.time.durationMs,
        enemyId: scenario.enemy.id,
      },
      effectiveActionTimeline: { scenario },
      actionExecutionPlan,
      actionReadinessTimeline: {},
      actionRuleDiagnostics,
      controlledActorTimeline,
      eventLog: runtime.eventLog,
      damageTimeline: [],
      resourceTimeline: [],
      kiboResourceTimeline: [],
      verifiedCombatRuntime: runtime,
      effectTimeline,
      summary: runtime.summary,
      diagnostics: {
        validationWarnings: [],
      },
    },
  });
}
