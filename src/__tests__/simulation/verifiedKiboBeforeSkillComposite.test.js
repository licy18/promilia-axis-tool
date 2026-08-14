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
const LEOPARD_KIBO_ID = 500216;
const LEOPARD_PASSIVE_SKILL_ID = 520044;
const LEOPARD_SIGNATURE_SKILL_ID = 50021601;
const LEOPARD_ACTIVE_SKILL_ID = 501009;
const OWNER_SLOT_ID = 'team-slot-3';
const TEST_SHIELD = Object.freeze({
  value: 999,
  outputTypes: [-1],
  elementTypes: [],
});

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified Kibo BeforeSkill composite runtime', () => {
  it('runs Leopard PetUltra action-window damage-up and current-HP real self-damage while bypassing shields', () => {
    const scenario = createLeopardScenario();
    const integrated = simulateScenario(scenario);
    const prepared = prepareLeopardRuntime(scenario);
    const { action, resolution, generation, effectTimeline, runtime } =
      prepared;
    const propertyCommand = generation.effectCommands.find(
      command =>
        command.sourceIdentity?.passiveSkillId === LEOPARD_PASSIVE_SKILL_ID
    );
    const vitalEvent = runtime.vitalEvents.find(
      event => event.type === 'VERIFIED_KIBO_PASSIVE_VITAL_DAMAGE'
    );
    const verifiedHits = runtime.damageEvents.filter(
      event =>
        event.type === 'VERIFIED_COMBAT_HIT' &&
        event.actionId === action.id &&
        !event.payload.kiboPassiveDerivedDamage
    );

    expect(resolution.ready).toBe(true);
    expect(Number(resolution.controlBinding.logic.skillTag)).toBe(14);
    expect(prepared.actionExecutionPlan.actions[0].execute).toBe(true);
    expect(generation.unresolved).toEqual([]);
    expect(propertyCommand).toMatchObject({
      sourceActionId: action.id,
      sourceKiboId: LEOPARD_KIBO_ID,
      sourceSlotId: OWNER_SLOT_ID,
      targetKind: 'kibo',
      targetId: action.actorId,
      timeMs: action.startMs,
      durationMs: action.durationMs,
      modifiers: [
        expect.objectContaining({
          attributeId: 21,
          bucket: 'dynamicExtra',
          valueRaw: expect.any(Number),
        }),
      ],
      sourceIdentity: expect.objectContaining({
        triggerEvent: 'current-skill-condition',
        passiveSkillId: LEOPARD_PASSIVE_SKILL_ID,
        effectElementId: 520044002,
      }),
    });
    expect(generation.vitalChangeCommands).toEqual([
      expect.objectContaining({
        kind: 'damage',
        timeMs: action.startMs,
        sourceActionId: action.id,
        sourceKiboId: LEOPARD_KIBO_ID,
        targetKind: 'kibo',
        targetId: action.actorId,
        targetKiboId: LEOPARD_KIBO_ID,
        targetSlotId: OWNER_SLOT_ID,
        passiveSkillId: LEOPARD_PASSIVE_SKILL_ID,
        trigger: expect.objectContaining({
          event: 'skill-before',
          sourceElementId: 520044003,
        }),
        vitalChange: expect.objectContaining({
          kind: 'damage',
          sourceElementId: 520044004,
          formula: expect.objectContaining({
            baseFunctionId: expect.any(Number),
            coefficientRaw: expect.any(Number),
          }),
        }),
      }),
    ]);
    expect(vitalEvent).toMatchObject({
      timeMs: action.startMs,
      actionId: action.id,
      actorId: action.actorId,
      targetId: action.actorId,
      payload: {
        passiveSkillId: LEOPARD_PASSIVE_SKILL_ID,
        sourceKiboId: LEOPARD_KIBO_ID,
        targetKind: 'kibo',
        targetKiboId: LEOPARD_KIBO_ID,
        damageType: expect.any(Number),
        damageTypeName: 'Real',
        formulaId: expect.any(Number),
        beforeValue: expect.any(Number),
        currentHpSnapshot: expect.any(Number),
        coefficientRaw: expect.any(Number),
        requestedDamage: expect.any(Number),
        appliedDamage: expect.any(Number),
        change: expect.any(Number),
        afterValue: expect.any(Number),
        lethal: false,
        shieldsBypassed: true,
        valueShieldsBefore: [TEST_SHIELD],
        valueShieldsAfter: [TEST_SHIELD],
        synchronousSkillStartPolicy: 'not-applicable-target-survived',
        unresolvedReasons: [],
        appliedToCalculators: true,
      },
    });
    // P2-6：相对契约——真实 self-damage 必须伤害>0、HP 确实下降、前后值守恒（零伤害实现不得通过）
    const { beforeValue, requestedDamage, appliedDamage, change, afterValue } =
      vitalEvent.payload;
    expect(requestedDamage).toBeGreaterThan(0);
    expect(appliedDamage).toBeGreaterThan(0);
    expect(beforeValue).toBeGreaterThan(afterValue);
    expect(afterValue).toBe(beforeValue + change);
    expect(change).toBeLessThan(0);
    expect(runtime.summary.kiboPassiveVitalDamageEventCount).toBe(1);
    expect(
      integrated.verifiedCombatRuntime.vitalEvents.find(
        event => event.type === 'VERIFIED_KIBO_PASSIVE_VITAL_DAMAGE'
      )
    ).toMatchObject({
      actionId: action.id,
      payload: {
        beforeValue: expect.any(Number),
        requestedDamage: expect.any(Number),
        afterValue: expect.any(Number),
      },
    });
    const sameFrameActionEvents = integrated.eventLog.filter(
      event => event.actionId === action.id && event.timeMs === action.startMs
    );
    const eventIndex = type =>
      sameFrameActionEvents.findIndex(event => event.type === type);
    expect(eventIndex('VERIFIED_KIBO_RESOURCE_CHANGE')).toBeGreaterThanOrEqual(
      0
    );
    expect(eventIndex('COOLDOWN_START')).toBeGreaterThan(
      eventIndex('VERIFIED_KIBO_RESOURCE_CHANGE')
    );
    expect(eventIndex('EFFECT_APPLIED')).toBeGreaterThan(
      eventIndex('COOLDOWN_START')
    );
    expect(eventIndex('VERIFIED_KIBO_PASSIVE_VITAL_DAMAGE')).toBeGreaterThan(
      eventIndex('EFFECT_APPLIED')
    );
    expect(
      runtime.finalState.kiboVitals.find(
        vital => vital.kiboId === LEOPARD_KIBO_ID
      )
    ).toMatchObject({
      slotId: OWNER_SLOT_ID,
      currentHp: expect.any(Number),
      valueShields: [TEST_SHIELD],
    });
    expect(verifiedHits.length).toBeGreaterThan(0);
    expect(
      verifiedHits.every(event =>
        event.payload.dynamicPropertyTrace.source.some(
          trace => trace.attributeId === 21
        )
      )
    ).toBe(true);

    const actionEndMs = action.startMs + action.durationMs;
    expect(
      resolveActiveEffectsAt(effectTimeline, actionEndMs - 0.001, {
        targetKind: 'kibo',
        targetId: action.actorId,
        calculatorOnly: true,
      }).some(effect => effect.effectId === propertyCommand.effectId)
    ).toBe(true);
    expect(
      resolveActiveEffectsAt(effectTimeline, actionEndMs, {
        targetKind: 'kibo',
        targetId: action.actorId,
        calculatorOnly: true,
      }).some(effect => effect.effectId === propertyCommand.effectId)
    ).toBe(false);
  });

  it('does not run either branch for the real Leopard PetNormalSkill action', () => {
    const scenario = createLeopardScenario({
      actionId: 'leopard-active',
      skillId: LEOPARD_ACTIVE_SKILL_ID,
      eventType: 'active',
    });
    const { action, resolution, generation, runtime, actionExecutionPlan } =
      prepareLeopardRuntime(scenario, { isolateActionMechanics: true });

    expect(resolution.ready).toBe(true);
    expect(Number(resolution.controlBinding.logic.skillTag)).toBe(13);
    expect(actionExecutionPlan.actions).toEqual([
      expect.objectContaining({
        actionId: action.id,
        execute: false,
        violationCodes: ['background-action-derivation-invalid'],
      }),
    ]);
    expect(
      generation.effectCommands.some(
        command =>
          command.sourceIdentity?.passiveSkillId === LEOPARD_PASSIVE_SKILL_ID
      )
    ).toBe(false);
    expect(generation.vitalChangeCommands).toEqual([]);
    expect(
      generation.conditionSuppressions.filter(
        suppression =>
          suppression.actionId === action.id &&
          suppression.skillId === LEOPARD_PASSIVE_SKILL_ID
      )
    ).toEqual([
      expect.objectContaining({
        effectKind: 'conditional-property-effect',
        actualSkillTags: [13],
        reason: 'kibo-passive-current-skill-tag-condition-not-matched',
      }),
      expect.objectContaining({
        effectKind: 'before-skill-vital-change',
        actualSkillTags: [13],
        reason: 'kibo-passive-skill-tag-condition-not-matched',
      }),
    ]);
    expect(
      runtime.vitalEvents.some(event =>
        event.type.startsWith('VERIFIED_KIBO_PASSIVE_VITAL_DAMAGE')
      )
    ).toBe(false);
    expect(
      runtime.damageEvents
        .filter(event => event.actionId === action.id)
        .flatMap(event => event.payload.dynamicPropertyTrace?.source ?? [])
        .some(trace => trace.attributeId === 21)
    ).toBe(false);
  });

  it.each([
    ['not equipped', 'none'],
    ['equipped on a different actor lane', 'wrong-actor'],
  ])('does not apply when Leopard is %s', (_label, equipMode) => {
    const scenario = createLeopardScenario({ equipMode });
    const action = scenario.actions[0];
    const evidenceScenario = createLeopardScenario();
    const evidenceAction = evidenceScenario.actions[0];
    const resolution = resolveVerifiedCombatActionMechanics(evidenceAction, {
      combatScenario: evidenceScenario.combatScenario,
    });
    const generation = createVerifiedKiboPassiveGeneration({
      scenario,
      actionResolutionById: new Map([[action.id, resolution]]),
    });

    expect(resolution.ready).toBe(true);
    expect(generation.effectCommands).toEqual([]);
    expect(generation.vitalChangeCommands).toEqual([]);
    expect(generation.unresolved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: action.id,
          kiboId: LEOPARD_KIBO_ID,
          skillId: LEOPARD_PASSIVE_SKILL_ID,
          reasons: ['kibo-passive-equipped-source-binding-mismatch'],
        }),
      ])
    );
  });

  it('allows the minimum real self-damage to reach zero and exposes the future-hit death scheduler boundary', () => {
    const scenario = createLeopardScenario({
      kiboCurrentHp: 1,
      kiboMaxHp: 1000,
    });
    const { action, runtime } = prepareLeopardRuntime(scenario);
    const vitalEvent = runtime.vitalEvents.find(
      event => event.type === 'VERIFIED_KIBO_PASSIVE_VITAL_DAMAGE'
    );

    expect(vitalEvent).toMatchObject({
      timeMs: action.startMs,
      actionId: action.id,
      payload: {
        beforeValue: 1,
        requestedDamage: 1,
        appliedDamage: 1,
        change: -1,
        afterValue: 0,
        lethal: true,
        minimumNominalDamage: 1,
        minimumRemainingHp: null,
        shieldsBypassed: true,
        valueShieldsBefore: [TEST_SHIELD],
        valueShieldsAfter: [TEST_SHIELD],
        synchronousSkillStartPolicy: 'continues-after-before-skill-self-kill',
        unresolvedReasons: [
          'kibo-passive-self-kill-future-hit-death-scheduler-unresolved',
        ],
        appliedToCalculators: true,
      },
    });
    expect(
      runtime.finalState.kiboVitals.find(
        vital => vital.kiboId === LEOPARD_KIBO_ID
      )?.currentHp
    ).toBe(0);
  });

  it('blocks the signature at insufficient SP before applying BeforeSkill self-damage', () => {
    const scenario = createLeopardScenario({
      initialKiboEnergy: 99,
    });
    const actionId = scenario.actions[0].id;
    const result = simulateScenario(scenario);

    expect(result.verifiedCombatRuntime.executionBlocks).toEqual([
      expect.objectContaining({
        actionId,
        ownerKind: 'kibo',
        kiboId: LEOPARD_KIBO_ID,
        requiredValue: 100,
        currentValue: 99,
        reason: 'verified-kibo-resource-insufficient',
      }),
    ]);
    expect(
      result.actionExecutionPlan.actions.find(
        action => action.actionId === actionId
      )
    ).toMatchObject({
      execute: false,
      violationCodes: ['verified-resource-cost-unavailable'],
    });
    expect(
      result.verifiedCombatRuntime.vitalEvents.some(
        event =>
          event.actionId === actionId &&
          event.type.startsWith('VERIFIED_KIBO_PASSIVE_VITAL_DAMAGE')
      )
    ).toBe(false);
    expect(
      result.verifiedCombatRuntime.finalState.kiboVitals.find(
        vital => vital.kiboId === LEOPARD_KIBO_ID
      )
    ).toMatchObject({
      currentHp: 1000,
      valueShields: [TEST_SHIELD],
    });
    expect(
      result.verifiedCombatRuntime.damageEvents.some(
        event => event.actionId === actionId
      )
    ).toBe(false);
  });
});

function prepareLeopardRuntime(
  scenario,
  { isolateActionMechanics = false } = {}
) {
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
    ...(isolateActionMechanics ? {} : { actionExecutionPlan }),
    actionResolutionById,
  });
  const effectTimeline = createEffectRuntimeTimeline({
    scenario,
    ...(isolateActionMechanics ? {} : { actionExecutionPlan }),
    generatedCommands: generation.effectCommands,
  });
  const runtime = createVerifiedCombatRuntime({
    scenario,
    ...(isolateActionMechanics ? {} : { actionExecutionPlan }),
    controlledActorTimeline,
    effectTimeline,
    kiboPassiveGeneration: generation,
  });
  return {
    action,
    resolution,
    actionRuleDiagnostics,
    actionExecutionPlan,
    controlledActorTimeline,
    generation,
    effectTimeline,
    runtime,
  };
}

function createLeopardScenario({
  actionId = 'leopard-signature',
  skillId = LEOPARD_SIGNATURE_SKILL_ID,
  eventType = 'signature',
  equipMode = 'owner',
  initialKiboEnergy = 100,
  kiboCurrentHp = 1000,
  kiboMaxHp = 1000,
} = {}) {
  const actionTiming =
    skillId === LEOPARD_SIGNATURE_SKILL_ID
      ? { durationFrames: 78, durationMs: 1300 }
      : { durationFrames: 160, durationMs: 2666.666667 };
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const wrongActorCharacterId = Number(DEFAULT_WORKBENCH_SELECTION.characterId);
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config => {
    const characterId = Number(config.characterId);
    const shouldEquip =
      (equipMode === 'owner' && characterId === OWNER_CHARACTER_ID) ||
      (equipMode === 'wrong-actor' && characterId === wrongActorCharacterId);
    const shouldClearOwner =
      characterId === OWNER_CHARACTER_ID && equipMode !== 'owner';
    if (!shouldEquip && !shouldClearOwner) return config;
    return {
      ...config,
      loadout: {
        ...config.loadout,
        kiboId: shouldEquip ? LEOPARD_KIBO_ID : null,
      },
    };
  });
  const equippedSlotId =
    equipMode === 'owner'
      ? OWNER_SLOT_ID
      : equipMode === 'wrong-actor'
        ? 'team-slot-1'
        : null;
  const initialRuntimeState = {
    controlledActor: {
      actorId: `actor-${OWNER_CHARACTER_ID}`,
      characterId: OWNER_CHARACTER_ID,
    },
    ...(equippedSlotId == null
      ? {}
      : {
          kiboEnergyBySlot: [
            {
              slotId: equippedSlotId,
              kiboId: LEOPARD_KIBO_ID,
              currentValue: initialKiboEnergy,
              maxValue: 100,
            },
          ],
          kiboVitalsBySlot: [
            {
              slotId: equippedSlotId,
              kiboId: LEOPARD_KIBO_ID,
              currentValue: kiboCurrentHp,
              maxValue: kiboMaxHp,
              valueShields: [TEST_SHIELD],
            },
          ],
        }),
  };
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs: 4000,
    teamSlots,
    actorConfigs,
    actions: [
      createWorkbenchActionDraft({
        id: actionId,
        type: 'kiboEvent',
        actorCharacterId: OWNER_CHARACTER_ID,
        skillId,
        kiboId: LEOPARD_KIBO_ID,
        actionVariantIndex: 0,
        startMs: 0,
        durationMs: actionTiming.durationMs,
        durationFrames: actionTiming.durationFrames,
        timingSource: 'azpr-unity-skill-control-root',
        timingStatus: 'verified',
        needsTimingData: false,
        eventType,
      }),
    ],
    initialRuntimeState,
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return compileProject(project, getWorkbenchGameData());
}
