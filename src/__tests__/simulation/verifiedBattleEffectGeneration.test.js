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
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import {
  createActionExecutionPlan,
} from '../../simulation/engine/actionExecutionPlan';
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

    expect(generation.effectCommands).toEqual([
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
    ]);
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
      effectCommandCount: 1,
      generatedCount: 1,
    });
    expect(integrated.effectTimeline.summary).toMatchObject({
      calculatorAppliedEffectCount: 2,
    });
    expect(sumDamage(integrated.verifiedCombatRuntime, 'fire-kibo-signature')).toBe(
      appliedDamage
    );
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

function sumDamage(runtime, actionId) {
  return runtime.damageEvents
    .filter(event => event.actionId === actionId)
    .reduce((sum, event) => sum + Number(event.payload.rawDamage ?? 0), 0);
}
