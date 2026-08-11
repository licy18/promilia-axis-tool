import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { createVerifiedWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getWorkbenchGameData,
  normalizeWorkbenchActorConfigs,
} from '../../domain/workbenchProjectFactory';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { projectEffectRuntimeIntervals } from '../../simulation/projection/projectEffectIntervals';

const HAN_ID = 101003;
const RUBY_ID = 103002;
const JADE_ID = 101010;
const FIRE_KIBO_ID = 500039;
const SECOND_KIBO_ID = 500469;
const THIRD_KIBO_ID = 500003;

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(mechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('M9 public team causal chain', () => {
  it('replays resources, variants, marks, buffs, and later combat values in one real team', () => {
    const withBuff = simulateTeam({ includeFireKiboAction: true });
    const executed = new Set(
      withBuff.actionExecutionPlan.actions
        .filter(action => action.execute)
        .map(action => action.actionId)
    );
    for (const actionId of [
      'han-star-skill',
      'ruby-ultimate',
      'jade-limit-counter',
      'jade-ultimate',
      'jade-charged-variant',
    ]) {
      expect(executed.has(actionId), actionId).toBe(true);
    }
    expect(
      withBuff.actionExecutionPlan.actions.find(
        action => action.actionId === 'fire-kibo-signature'
      )
    ).toMatchObject({
      execute: false,
      violationCodes: ['controlled-actor-action-unavailable'],
    });

    const fireMarkEvents = withBuff.verifiedTuningMarkGeneration.events.filter(
      event => event.profileKey === 'fire' && event.delta !== 0
    );
    expect(
      fireMarkEvents.filter(
        event => event.kind === 'acquire' && event.actionId === 'han-star-skill'
      )
    ).toHaveLength(2);
    expect(
      fireMarkEvents.some(
        event => event.kind === 'consume' && event.actionId === 'ruby-ultimate'
      )
    ).toBe(true);

    const specialResourceRuntime =
      withBuff.verifiedCombatRuntime.specialResourceRuntime;
    expect(
      specialResourceRuntime.resourceEvents.find(
          event =>
            event.actionId === 'ruby-ultimate' &&
            event.payload.resourceIdentity === 'actor:103002:element:103002047' &&
            event.payload.operation === 'set-to-capacity'
        )
      ).toMatchObject({
      payload: {
        operation: 'set-to-capacity',
        beforeValue: 0,
        change: 12,
        afterValue: 12,
      },
    });
    expect(
      specialResourceRuntime.resourceEvents.filter(
        event =>
          event.actionId === 'jade-limit-counter' &&
          event.payload.operation === 'gain'
      )
    ).toHaveLength(8);
    expect(
      specialResourceRuntime.stateEvents.find(
        event =>
          event.actionId === 'jade-ultimate' &&
          event.payload.operation === 'transform'
      )
    ).toMatchObject({
      payload: {
        stateElementId: 101010129,
        stateDurationMs: 10000,
      },
    });
    expect(
      specialResourceRuntime.selectionByActionId.get('jade-charged-variant')
    ).toMatchObject({
      controlSkillId: 10101010,
      selectedSubSkillIndex: 2,
      sourceKind: 'verified-active-switch-skill-index-window',
    });

    expect(
      withBuff.verifiedBattleEffectGeneration.effectCommands.filter(
        command => command.sourceActionId === 'fire-kibo-signature'
      )
    ).toEqual([]);
    expect(sumActionDamage(withBuff, 'fire-kibo-signature')).toBe(0);

    expect(
      withBuff.runtimeOutputs.stateCurves.resources.curvesBySpecialResource.map(
        curve => curve.characterId
      )
    ).toEqual(expect.arrayContaining([RUBY_ID, JADE_ID]));
    expect(
      withBuff.runtimeOutputs.stateCurves.resources.curvesBySpecialResource.some(
        curve => curve.characterId === HAN_ID
      )
    ).toBe(false);
    expect(
      withBuff.runtimeOutputs.stateCurves.resources.curvesByKibo
        .map(curve => curve.kiboId)
        .sort((left, right) => left - right)
    ).toEqual([THIRD_KIBO_ID, FIRE_KIBO_ID, SECOND_KIBO_ID]);
    expect(
      withBuff.verifiedCombatRuntime.damageEvents.some(
        event =>
          event.actionId === 'jade-charged-variant' &&
          Number(event.payload.rawDamage) > 0 &&
          Number(event.payload.toughnessDamage) >= 0
      )
    ).toBe(true);

    const jadePassiveEvents = withBuff.effectTimeline.events.filter(
      event => event.effectId === 'battle-element:101010206' && event.after
    );
    expect(
      jadePassiveEvents.map(event => [event.actionId, event.after.stacks])
    ).toEqual([
      ['switch-to-jade--on-enter--actor-101010--star-carry', 1],
      ['jade-ultimate', 1],
      ['jade-charged-variant', 2],
    ]);
    const jadeBurstInterval = projectEffectRuntimeIntervals({
      effectTimeline: withBuff.effectTimeline,
      durationMs: 45_000,
      frameRate: 60,
    }).intervals.find(
      interval =>
        interval.effectId === 'battle-element:101010129' &&
        interval.targetId === `actor-${JADE_ID}`
    );
    expect(jadeBurstInterval).toMatchObject({
      effectName: '爆发状态buff',
      sourceActionId: 'jade-ultimate',
    });
    expect(jadeBurstInterval.startMs).toBeCloseTo(29300 + (272 * 1000) / 60, 2);
    expect(jadeBurstInterval.endMs).toBeCloseTo(
      29300 + (272 * 1000) / 60 + 10_000,
      2
    );
    expect(
      withBuff.verifiedCombatRuntime.damageEvents
        .filter(event => event.actionId === 'jade-charged-variant')
        .flatMap(event => event.payload.dynamicPropertyTrace.source)
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attributeId: 1,
          dynamicPercentRaw: 1000,
          effects: expect.arrayContaining([
            expect.objectContaining({
              effectId: 'battle-element:101010206',
              stacks: 2,
              valueRaw: 1000,
            }),
          ]),
        }),
      ])
    );

    const packageWithoutJadePassive = structuredClone(mechanicsPackage);
    packageWithoutJadePassive.specialResourceCatalog.passiveEffects = [];
    installVerifiedCombatMechanicsPackage(packageWithoutJadePassive);
    const withoutPassive = simulateTeam({ includeFireKiboAction: true });
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    expect(sumActionDamage(withBuff, 'jade-charged-variant')).toBeGreaterThan(
      sumActionDamage(withoutPassive, 'jade-charged-variant')
    );
  });
});

function simulateTeam({ includeFireKiboAction }) {
  const teamSlots = [
    { slotId: 'team-slot-1', position: 0, characterId: HAN_ID },
    { slotId: 'team-slot-2', position: 1, characterId: RUBY_ID },
    { slotId: 'team-slot-3', position: 2, characterId: JADE_ID },
  ];
  const selection = {
    ...DEFAULT_WORKBENCH_SELECTION,
    characterId: HAN_ID,
    secondaryCharacterId: RUBY_ID,
  };
  const kiboByCharacterId = {
    [HAN_ID]: SECOND_KIBO_ID,
    [RUBY_ID]: FIRE_KIBO_ID,
    [JADE_ID]: THIRD_KIBO_ID,
  };
  const actorConfigs = normalizeWorkbenchActorConfigs(
    [],
    selection,
    teamSlots
  ).map(config => ({
    ...config,
    initialSp: 100,
    loadout: {
      ...config.loadout,
      kiboId: kiboByCharacterId[config.characterId],
    },
  }));
  const actions = [
    createSkillAction({
      id: 'han-star-skill',
      characterId: HAN_ID,
      skillId: 10100312,
      actionKind: 'star-skill',
      startMs: 0,
    }),
    createSwitchAction({
      id: 'switch-to-ruby',
      fromCharacterId: HAN_ID,
      toCharacterId: RUBY_ID,
      startMs: 7500,
    }),
    createSkillAction({
      id: 'ruby-ultimate',
      characterId: RUBY_ID,
      skillId: 10300213,
      actionKind: 'ultimate',
      startMs: 11300,
    }),
    ...(includeFireKiboAction
      ? [
          createKiboAction({
            id: 'fire-kibo-signature',
            characterId: RUBY_ID,
            kiboId: FIRE_KIBO_ID,
            skillId: 50003901,
            actionKind: 'signature',
            startMs: 30000,
          }),
        ]
      : []),
    createSwitchAction({
      id: 'switch-to-jade',
      fromCharacterId: RUBY_ID,
      toCharacterId: JADE_ID,
      startMs: 19500,
    }),
    createSkillAction({
      id: 'jade-limit-counter',
      characterId: JADE_ID,
      skillId: 10101021,
      actionKind: 'limit-counter',
      actionVariantIndex: 1,
      startMs: 24500,
    }),
    createSkillAction({
      id: 'jade-ultimate',
      characterId: JADE_ID,
      skillId: 10101013,
      actionKind: 'ultimate',
      startMs: 29300,
    }),
    createSkillAction({
      id: 'jade-charged-variant',
      characterId: JADE_ID,
      skillId: 10101001,
      actionKind: 'charged-attack',
      actionVariantIndex: 2,
      selectedSubSkillIndex: 2,
      startMs: 37000,
    }),
  ];
  const project = createWorkbenchProject(selection, {
    durationMs: 45000,
    teamSlots,
    actorConfigs,
    actions,
    enemyConfig: {
      level: 80,
      hpMultiplier: 100,
      defenseMultiplier: 1,
      toughnessMultiplier: 1,
      initialToughnessRatio: 1,
    },
    initialRuntimeState: {
      controlledActor: {
        actorId: `actor-${HAN_ID}`,
        characterId: HAN_ID,
      },
      kiboEnergyBySlot: teamSlots.map(slot => ({
        slotId: slot.slotId,
        kiboId: kiboByCharacterId[slot.characterId],
        currentValue: 100,
        maxValue: 100,
      })),
    },
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return simulateScenario(compileProject(project, getWorkbenchGameData()));
}

function createSkillAction({
  id,
  characterId,
  skillId,
  actionKind,
  actionVariantIndex = 0,
  selectedSubSkillIndex = null,
  startMs,
}) {
  return createWorkbenchActionDraft({
    id,
    type: 'skill',
    actorCharacterId: characterId,
    skillId,
    actionVariantIndex,
    startMs,
    durationMs: resolveActionDurationMs({
      ownerId: characterId,
      actionKind,
      actionVariantIndex,
      selectedSubSkillIndex,
    }),
  });
}

function createKiboAction({
  id,
  characterId,
  kiboId,
  skillId,
  actionKind,
  startMs,
}) {
  return createWorkbenchActionDraft({
    id,
    type: 'kiboEvent',
    actorCharacterId: characterId,
    kiboId,
    skillId,
    eventType: actionKind,
    startMs,
    durationMs: resolveActionDurationMs({ ownerId: kiboId, actionKind }),
  });
}

function createSwitchAction({ id, fromCharacterId, toCharacterId, startMs }) {
  return createWorkbenchActionDraft({
    id,
    type: 'switch',
    actorCharacterId: fromCharacterId,
    targetCharacterId: toCharacterId,
    startMs,
    durationMs: 0,
  });
}

function resolveActionDurationMs({
  ownerId,
  actionKind,
  actionVariantIndex = 0,
  selectedSubSkillIndex = null,
}) {
  const mapping = mechanicsPackage.actionMappings.find(
    action =>
      action.ownerId === ownerId &&
      action.actionKind === actionKind &&
      action.actionVariantIndex === actionVariantIndex
  );
  const timing =
    selectedSubSkillIndex == null
      ? mapping?.actionTiming
      : mapping?.actionTiming?.variantTimings?.find(
          variant => variant.subSkillIndex === selectedSubSkillIndex
        );
  const durationFrames = timing?.occupancy?.durationFrames;
  if (!Number.isInteger(durationFrames) || durationFrames <= 0) {
    throw new Error(
      `verified action duration missing: ${ownerId}/${actionKind}/${actionVariantIndex}/${selectedSubSkillIndex}`
    );
  }
  return (durationFrames * 1000) / 60;
}

function sumActionDamage(result, actionId) {
  return result.verifiedCombatRuntime.damageEvents
    .filter(event => event.actionId === actionId)
    .reduce((sum, event) => sum + Number(event.payload.rawDamage ?? 0), 0);
}
