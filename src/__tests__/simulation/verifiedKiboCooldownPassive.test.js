import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { createVerifiedWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import { createVerifiedJointAttackRuntimeBinding } from '../../domain/verifiedJointAttackRuntimeContract';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getWorkbenchGameData,
  normalizeWorkbenchActorConfigs,
} from '../../domain/workbenchProjectFactory';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { createVerifiedKiboCooldownModifierSession } from '../../simulation/mechanics/verifiedKiboCooldownModifierSession';

const OWNER_ID = 101003;
const KIBO_ID = 500067;
const TAG13_KIBO_ID = 500066;
const PASSIVE_SKILL_ID = 520046;
const SIGNATURE_SKILL_ID = 50006701;
const ACTIVE_SKILL_ID = 502004;
const BREAK_SKILL_ID = 50006704;
const TAG13_BREAK_SKILL_ID = 50006604;
const STAR_COMBO_SKILL_ID = 10100312;
const OWNER_SLOT_ID = 'team-slot-1';
const BREAK_STARTS = [0, 5000, 9750, 14250, 18500];

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(mechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified Kibo accepted-skill cooldown passive', () => {
  it('uses the old stack for each source-resolved joint-strike acceptance and projects 0→4 layers', () => {
    const scenario = createWaterKiboScenario({
      durationMs: 3000,
      actions: createJointPair({ startMs: 0 }),
    });
    const sourceAction = scenario.actions.find(
      action => action.id === 'joint-kibo-0'
    );
    const session = createVerifiedKiboCooldownModifierSession({ scenario });
    const evaluations = BREAK_STARTS.map((startMs, index) => {
      const action = {
        ...sourceAction,
        id: `accepted-joint-${index + 1}`,
        startMs,
      };
      const evaluation = session.evaluate({
        action,
        ownerKind: 'kibo',
        ownerId: KIBO_ID,
        baseCooldown: { durationMs: 5000 },
        currentEffectiveCooldown: { durationMs: 5000 },
      });
      session.onActionAccepted({
        action,
        ownerKind: 'kibo',
        ownerId: KIBO_ID,
        actionOrderIndex: index,
        cooldownPolicy: {
          setCd: true,
          source: 'test-source-resolved-joint-strike-acceptance',
        },
      });
      return evaluation;
    });

    expect(
      evaluations.map(evaluation => evaluation.formula.baseDurationMs)
    ).toEqual([5000, 5000, 5000, 5000, 5000]);
    expect(
      evaluations.map(evaluation => evaluation.effectiveDurationMs)
    ).toEqual([5000, 4750, 4500, 4250, 4000]);
    expect(
      evaluations.map(evaluation => evaluation.passiveStates[0].stackCount)
    ).toEqual([0, 1, 2, 3, 4]);
    expect(
      evaluations.map(
        evaluation => evaluation.modifiers[0]?.stackCountUsed ?? 0
      )
    ).toEqual([0, 1, 2, 3, 4]);

    const passiveTransitions = session.snapshot().acceptedTransitions;
    expect(passiveTransitions).toHaveLength(5);
    expect(
      passiveTransitions.map(transition => [
        transition.stackBefore,
        transition.stackAfter,
      ])
    ).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 4],
    ]);
    expect(
      passiveTransitions.every(
        transition =>
          transition.ownerKind === 'kibo' &&
          transition.actualSkillTags.includes(15)
      )
    ).toBe(true);
  });

  it('does not accept or add a layer for a tag13 autonomous action with unresolved cadence', () => {
    const scenario = createWaterKiboScenario({
      kiboId: TAG13_KIBO_ID,
      durationMs: 9000,
      actions: [
        createKiboAction({
          id: 'tag13-active',
          kiboId: TAG13_KIBO_ID,
          skillId: ACTIVE_SKILL_ID,
          eventType: 'active',
          startMs: 0,
          durationFrames: 165,
        }),
        ...createJointPair({
          index: 1,
          startMs: 3000,
          kiboId: TAG13_KIBO_ID,
          breakSkillId: TAG13_BREAK_SKILL_ID,
        }),
      ],
    });
    const result = simulateScenario(scenario);
    const activeTransition =
      result.actionRuleDiagnostics.cooldownModifierSession.acceptedTransitions.find(
        transition => transition.actionId === 'tag13-active'
      );
    const breakWindow =
      result.actionRuleDiagnostics.readinessTimeline.cooldownWindows.find(
        window => window.actionId === 'joint-kibo-3000'
      );

    expect(activeTransition).toBeUndefined();
    expect(
      result.actionExecutionPlan.actions.find(
        action => action.actionId === 'tag13-active'
      )
    ).toMatchObject({
      execute: false,
      violationCodes: ['background-action-derivation-invalid'],
    });
    expect(breakWindow).toMatchObject({
      baseDurationMs: 5000,
      effectiveDurationMs: 5000,
    });
    expect(
      result.verifiedKiboPassiveGeneration.effectCommands.some(
        command =>
          command.sourceActionId === 'tag13-active' &&
          command.sourceIdentity?.triggerEvent === 'accepted-skill-start'
      )
    ).toBe(false);
  });

  it('keeps attr57 out of a controlled non-water Hit branch', () => {
    installVerifiedCombatMechanicsPackage(
      createSyntheticBreakElementPackage({ elementalType: 1 })
    );
    const scenario = createWaterKiboScenario({
      durationMs: 3000,
      actions: createJointPair({ index: 0, startMs: 0 }),
    });
    const result = simulateScenario(scenario);
    const hit = result.verifiedCombatRuntime.damageEvents.find(
      event =>
        event.type === 'VERIFIED_COMBAT_HIT' &&
        event.actionId === 'joint-kibo-0'
    );
    expect(hit).toBeDefined();
    const traces = hit.payload.dynamicPropertyTrace.source;

    expect(traces.some(trace => trace.attributeId === 57)).toBe(false);
    expect(
      result.verifiedKiboPassiveGeneration.effectCommands.some(
        command =>
          command.sourceIdentity?.passiveSkillId === PASSIVE_SKILL_ID &&
          command.modifiers?.some(modifier => modifier.attributeId === 57)
      )
    ).toBe(true);
  });

  it('replays admission from empty state so a 99 SP PetUltra block leaves the later joint strike at zero layers', () => {
    const scenario = createWaterKiboScenario({
      durationMs: 9000,
      initialKiboEnergy: 99,
      actions: [
        createKiboAction({
          id: 'blocked-signature',
          skillId: SIGNATURE_SKILL_ID,
          eventType: 'signature',
          startMs: 0,
          durationFrames: 134,
        }),
        ...createJointPair({ index: 1, startMs: 3000 }),
      ],
    });
    const result = simulateScenario(scenario);
    const breakWindow =
      result.actionRuleDiagnostics.readinessTimeline.cooldownWindows.find(
        window => window.actionId === 'joint-kibo-3000'
      );

    expect(result.actionRuleDiagnostics.admissionReplay).toMatchObject({
      status: 'verified-admission-replay-stable',
      passCount: 2,
      resourceBlockCount: 1,
    });
    expect(
      result.actionExecutionPlan.actions.find(
        action => action.actionId === 'blocked-signature'
      )
    ).toMatchObject({
      execute: false,
      violationCodes: ['verified-resource-cost-unavailable'],
    });
    expect(
      result.actionRuleDiagnostics.readinessTimeline.cooldownWindows.some(
        window => window.actionId === 'blocked-signature'
      )
    ).toBe(false);
    expect(
      result.actionRuleDiagnostics.acceptedSkillStartTransitions.some(
        transition => transition.actionId === 'blocked-signature'
      )
    ).toBe(false);
    expect(breakWindow).toMatchObject({
      baseDurationMs: 5000,
      effectiveDurationMs: 5000,
    });
    expect(
      result.actionRuleDiagnostics.cooldownModifierSession.acceptedTransitions.map(
        transition => [
          transition.actionId,
          transition.stackBefore,
          transition.stackAfter,
        ]
      )
    ).toEqual([['joint-kibo-3000', 0, 1]]);
    expect(
      result.verifiedKiboPassiveGeneration.effectCommands.some(
        command =>
          command.sourceActionId === 'blocked-signature' &&
          command.sourceIdentity?.triggerEvent === 'accepted-skill-start'
      )
    ).toBe(false);
  });

  it('keeps accepted SkillStart independent from cooldown Cast and applies the native 25% minimum', () => {
    const scenario = createWaterKiboScenario({
      actions: [
        createKiboAction({
          id: 'session-signature',
          skillId: SIGNATURE_SKILL_ID,
          eventType: 'signature',
          startMs: 0,
          durationFrames: 134,
        }),
      ],
    });
    const action = scenario.actions[0];
    const session = createVerifiedKiboCooldownModifierSession({ scenario });
    for (let index = 0; index < 4; index += 1) {
      session.onActionAccepted({
        action: { ...action, id: `no-cast-${index}`, startMs: index },
        ownerKind: 'kibo',
        ownerId: KIBO_ID,
        actionOrderIndex: index,
        cooldownPolicy: { setCd: false, source: 'test-explicit-set-cd-false' },
      });
    }
    const ordinary = session.evaluate({
      action,
      ownerKind: 'kibo',
      ownerId: KIBO_ID,
      baseCooldown: { durationMs: 1000 },
      currentEffectiveCooldown: { durationMs: 1000 },
    });
    const clamped = session.evaluate({
      action,
      ownerKind: 'kibo',
      ownerId: KIBO_ID,
      baseCooldown: { durationMs: 1000 },
      currentEffectiveCooldown: { durationMs: 100 },
    });

    expect(session.snapshot().acceptedTransitions).toHaveLength(4);
    expect(
      session
        .snapshot()
        .acceptedTransitions.every(
          transition => transition.cooldownPolicy.setCd === false
        )
    ).toBe(true);
    expect(ordinary).toMatchObject({
      effectiveDurationMs: 800,
      formula: {
        totalPercentRaw: -2000,
        minimumCooldownBasisPoints: 2500,
        minimumDurationMs: 250,
        clamped: false,
      },
    });
    expect(clamped).toMatchObject({
      effectiveDurationMs: 250,
      formula: {
        inputDurationMs: 100,
        nativeDeltaMs: -200,
        unclampedDurationMs: -100,
        minimumDurationMs: 250,
        clamped: true,
      },
    });
  });
});

function createWaterKiboScenario({
  actions,
  durationMs = 12000,
  initialKiboEnergy = 100,
  kiboId = KIBO_ID,
}) {
  const teamSlots = [
    { slotId: OWNER_SLOT_ID, position: 0, characterId: OWNER_ID },
    { slotId: 'team-slot-2', position: 1, characterId: 103002 },
    { slotId: 'team-slot-3', position: 2, characterId: 101010 },
  ];
  const selection = {
    ...DEFAULT_WORKBENCH_SELECTION,
    characterId: OWNER_ID,
    secondaryCharacterId: 103002,
  };
  const actorConfigs = normalizeWorkbenchActorConfigs(
    [],
    selection,
    teamSlots
  ).map(config => ({
    ...config,
    initialSp: 100,
    loadout:
      Number(config.characterId) === OWNER_ID
        ? { ...config.loadout, kiboId }
        : config.loadout,
  }));
  const project = createWorkbenchProject(selection, {
    durationMs,
    initialToughnessRatio: 0.01,
    teamSlots,
    actorConfigs,
    actions,
    combatScenario: {
      jointAttackRuntime: createVerifiedJointAttackRuntimeBinding(),
    },
    initialRuntimeState: {
      controlledActor: {
        actorId: `actor-${OWNER_ID}`,
        characterId: OWNER_ID,
      },
      kiboEnergyBySlot: [
        {
          slotId: OWNER_SLOT_ID,
          kiboId,
          currentValue: initialKiboEnergy,
          maxValue: 100,
        },
      ],
    },
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return compileProject(project, getWorkbenchGameData());
}

function createJointPair({
  startMs,
  kiboId = KIBO_ID,
  breakSkillId = BREAK_SKILL_ID,
}) {
  return [
    createWorkbenchActionDraft({
      id: `joint-actor-${startMs}`,
      type: 'skill',
      actorCharacterId: OWNER_ID,
      skillId: STAR_COMBO_SKILL_ID,
      actionVariantIndex: 1,
      startMs,
      durationFrames: 50,
      durationMs: (50 * 1000) / 60,
    }),
    createKiboAction({
      id: `joint-kibo-${startMs}`,
      kiboId,
      skillId: breakSkillId,
      eventType: 'break',
      startMs,
      durationFrames: 94,
    }),
  ];
}

function createKiboAction({
  id,
  kiboId = KIBO_ID,
  skillId,
  eventType,
  startMs,
  durationFrames,
}) {
  return createWorkbenchActionDraft({
    id,
    type: 'kiboEvent',
    actorCharacterId: OWNER_ID,
    kiboId,
    skillId,
    actionVariantIndex: 0,
    eventType,
    startMs,
    durationFrames,
    durationMs: (durationFrames * 1000) / 60,
  });
}

function createSyntheticBreakElementPackage({ elementalType }) {
  return {
    ...mechanicsPackage,
    controlBindings: mechanicsPackage.controlBindings.map(binding =>
      Number(binding.controlSkillId) === BREAK_SKILL_ID
        ? {
            ...binding,
            hits: binding.hits.map(hit => ({
              ...hit,
              damage: { ...hit.damage, elementalType },
              sourceEvidenceStatus: 'test-controlled-element-branch',
              scenarioRuntimeStatus: 'test-controlled-element-branch',
            })),
          }
        : binding
    ),
  };
}
