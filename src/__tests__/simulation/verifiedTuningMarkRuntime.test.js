import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
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

const PANGPANG_ID = 101007;
const PANGPANG_NORMAL_SKILL_ID = 10100701;
const PANGPANG_ATTACK_INPUT = mechanicsPackage.actionMappings
  .find(
    mapping =>
      mapping.ownerId === PANGPANG_ID && mapping.actionKind === 'normal-attack'
  )
  .attackInputSegments.find(segment => segment.sequenceIndex === 3);

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(mechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified tuning mark runtime', () => {
  it('ships nine verified profiles while keeping unsafe action bindings unresolved', () => {
    const profiles = mechanicsPackage.tuningMechanicsCatalog.profiles;
    const effects = mechanicsPackage.controlBindings.flatMap(
      binding => binding.effects ?? []
    );
    const appliedAcquisitions = effects.filter(
      effect => effect.applied && effect.tuningMark
    );
    const appliedConsumes = effects.filter(
      effect => effect.applied && effect.tuningOverlimit
    );
    const unresolvedConsumes = effects.filter(
      effect => !effect.applied && effect.tuningOverlimit
    );

    expect(profiles).toHaveLength(9);
    expect(new Set(profiles.map(profile => profile.markId)).size).toBe(9);
    expect(
      profiles.every(
        profile =>
          profile.maxStacks === 5 &&
          profile.layerDurationMs === 20_000 &&
          profile.heldReadyMs === 5_000 &&
          profile.overlimitPacket.sourceIdentity
      )
    ).toBe(true);
    expect(appliedAcquisitions.length).toBeGreaterThan(0);
    expect(appliedConsumes.length).toBeGreaterThan(0);
    expect(unresolvedConsumes.every(effect => effect.reasons.length > 0)).toBe(
      true
    );
  });

  it('acquires real fire marks at authoritative frames and expires each layer after 20 seconds', () => {
    const result = simulateVerifiedProject({
      durationMs: 22_000,
      actions: [
        createWorkbenchActionDraft({
          id: 'han-star-skill',
          type: 'skill',
          actorCharacterId: 101003,
          skillId: 10100312,
          actionVariantIndex: 0,
          startMs: 0,
          durationMs: 1_400,
        }),
      ],
    });
    const fireChanges = result.verifiedTuningMarkGeneration.events
      .filter(event => event.profileKey === 'fire' && event.delta !== 0)
      .map(event => ({
        kind: event.kind,
        timeMs: event.timeMs,
        before: event.before,
        after: event.after,
      }));

    expect(fireChanges).toEqual([
      { kind: 'acquire', timeMs: 1050, before: 0, after: 1 },
      {
        kind: 'acquire',
        timeMs: 1166.666667,
        before: 1,
        after: 2,
      },
      { kind: 'expire', timeMs: 21050, before: 2, after: 1 },
      {
        kind: 'expire',
        timeMs: 21166.666667,
        before: 1,
        after: 0,
      },
    ]);
    expect(
      result.effectTimeline.events.some(
        event =>
          event.effectId === 'tuning-mark:150:persistent' &&
          event.appliedToCalculators
      )
    ).toBe(true);
    const persistentCommands =
      result.verifiedTuningMarkGeneration.effectCommands.filter(
        command => command.effectId === 'tuning-mark:150:persistent'
      );
    expect(persistentCommands.length).toBeGreaterThan(1);
    expect(
      persistentCommands.every(command =>
        command.tags.includes('tuning-mark-resource-mirror')
      )
    ).toBe(true);
  });

  it('projects all nine held profiles from one real hit without duplicate input nodes', () => {
    const initialRuntimeState = {
      tuningMarks: mechanicsPackage.tuningMechanicsCatalog.profiles.map(
        profile => createInheritedMark(profile, 20_000)
      ),
    };
    const result = simulateVerifiedProject({
      durationMs: 2_000,
      initialRuntimeState,
      actions: [createPangpangAttack('pangpang-hit', 0)],
    });
    const heldCombatEvents =
      result.verifiedTuningMarkGeneration.combatEvents.filter(event =>
        event.kind.startsWith('held-')
      );
    const heldTriggers = result.verifiedTuningMarkGeneration.events.filter(
      event => event.kind === 'held-trigger'
    );
    const tuningDamageEvents = result.verifiedCombatRuntime.damageEvents.filter(
      event => event.type === 'VERIFIED_TUNING_DAMAGE'
    );

    expect(heldCombatEvents).toHaveLength(10);
    expect(heldTriggers).toHaveLength(9);
    expect(new Set(heldTriggers.map(event => event.profileKey)).size).toBe(9);
    expect(tuningDamageEvents).toHaveLength(10);
    expect(
      tuningDamageEvents.filter(event => event.payload.profileKey === 'light')
    ).toHaveLength(2);
    expect(
      Number(
        tuningDamageEvents.find(event => event.payload.profileKey === 'earth')
          .payload.formulaBreakdown.weaknessResult.deducted
      )
    ).toBeGreaterThan(0);
  });

  it('respects the five-second held trigger gate across independent hits', () => {
    const fire = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
      profile => profile.key === 'fire'
    );
    const result = simulateVerifiedProject({
      durationMs: 8_000,
      initialRuntimeState: {
        tuningMarks: [createInheritedMark(fire, 20_000)],
      },
      actions: [
        createPangpangAttack('pangpang-hit-1', 0),
        createPangpangAttack('pangpang-hit-2', 1_000),
        createPangpangAttack('pangpang-hit-3', 6_000),
      ],
    });
    const fireHeld = result.verifiedTuningMarkGeneration.combatEvents.filter(
      event => event.kind === 'held-damage' && event.profile.key === 'fire'
    );

    expect(fireHeld.map(event => event.actionId)).toEqual([
      'pangpang-hit-1',
      'pangpang-hit-3',
    ]);
  });

  it('consumes three inherited wind marks and restores six absolute SP without sharing', () => {
    const wind = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
      profile => profile.key === 'wind'
    );
    const result = simulateVerifiedProject({
      durationMs: 6_000,
      initialSpByCharacterId: { 109001: 100 },
      initialRuntimeState: {
        tuningMarks: [
          createInheritedMark(wind, 20_000),
          // Normalization merges one row per mark, so put all layers together.
        ].map(mark => ({
          ...mark,
          layers: [
            ...mark.layers,
            ...createInheritedMark(wind, 20_000).layers,
            ...createInheritedMark(wind, 20_000).layers,
          ],
        })),
      },
      actions: [
        createWorkbenchActionDraft({
          id: 'muyin-ultimate',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900113,
          actionVariantIndex: 0,
          startMs: 0,
          durationMs: 3_600,
        }),
      ],
    });
    const consume = result.verifiedTuningMarkGeneration.events.find(
      event => event.kind === 'consume' && event.profileKey === 'wind'
    );
    const directSp = result.verifiedCombatRuntime.resourceEvents.find(
      event => event.payload.reason === 'tuning-overlimit-direct-sp'
    );

    expect(consume).toMatchObject({
      timeMs: 3050,
      before: 3,
      delta: -3,
      after: 0,
    });
    expect(directSp.payload).toMatchObject({
      valueUnit: 'absolute-sp-points',
      change: 6,
      formula: {
        consumedMarks: 3,
        spPerConsumedMark: 2,
        noShare: true,
        noEnhancement: true,
      },
    });
    expect(
      result.verifiedCombatRuntime.damageEvents.some(
        event =>
          event.type === 'VERIFIED_TUNING_DAMAGE' &&
          event.payload.profileKey === 'wind' &&
          event.payload.tuningKind === 'overlimit-damage'
      )
    ).toBe(true);
  });

  it('expires inherited layers on an empty action axis without synthetic damage', () => {
    const fire = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
      profile => profile.key === 'fire'
    );
    const result = simulateVerifiedProject({
      durationMs: 2_000,
      initialRuntimeState: {
        tuningMarks: [createInheritedMark(fire, 1_000)],
      },
      actions: [],
    });

    expect(result.verifiedTuningMarkGeneration.events).toEqual([
      expect.objectContaining({
        kind: 'expire',
        timeMs: 1_000,
        profileKey: 'fire',
        before: 1,
        after: 0,
      }),
    ]);
    expect(result.verifiedTuningMarkGeneration.combatEvents).toHaveLength(0);
    expect(
      result.verifiedTuningMarkGeneration.finalState.find(
        state => state.profileKey === 'fire'
      ).currentValue
    ).toBe(0);
  });
});

function createPangpangAttack(id, startMs) {
  return createWorkbenchActionDraft({
    id,
    type: 'skill',
    actorCharacterId: PANGPANG_ID,
    skillId: PANGPANG_NORMAL_SKILL_ID,
    actionVariantIndex: 0,
    startMs,
    durationMs: PANGPANG_ATTACK_INPUT.durationMs,
    attackGroupId: `${id}-group`,
    attackSequenceIndex: PANGPANG_ATTACK_INPUT.sequenceIndex,
    attackSequenceTotal: PANGPANG_ATTACK_INPUT.sequenceTotal,
    attackInput: PANGPANG_ATTACK_INPUT,
  });
}

function createInheritedMark(profile, remainingDurationMs) {
  return {
    markId: profile.markId,
    profileKey: profile.key,
    elementName: profile.element,
    heldReadyRemainingMs: 0,
    layers: [
      {
        remainingDurationMs,
        sourceActionId: `inherited-${profile.key}`,
        sourceActorId: 'actor-3',
        sourceIdentity: { profile: profile.sourceIdentity },
      },
    ],
  };
}

function simulateVerifiedProject({
  durationMs,
  actions,
  initialRuntimeState = null,
  initialSpByCharacterId = {},
}) {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config => ({
    ...config,
    initialSp:
      initialSpByCharacterId[Number(config.characterId)] ?? config.initialSp,
  }));
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs,
    teamSlots,
    actorConfigs,
    actions,
    initialRuntimeState,
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return simulateScenario(compileProject(project, getWorkbenchGameData()));
}
