import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import seed from '../../data/generated/workbench-seed.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { createSwitchAction } from '../../domain/projectSchema';
import {
  createSwitchTriggeredActionGeneration,
  resolveSwitchTriggeredCooldownGate,
} from '../../simulation/generation/switchTriggeredActionGeneration';

const skillsById = new Map(
  seed.gameData.skills.map(skill => [Number(skill.id), skill])
);

describe('switch triggered star-carry generation', () => {
  beforeEach(() => installVerifiedCombatMechanicsPackage(mechanicsPackage));
  afterEach(() => clearInstalledVerifiedCombatMechanicsPackage());

  it('derives the real exit and enter actions from one exact-frame switch', () => {
    const result = generate({
      actors: [actor(101003), actor(101007)],
      initialActorId: 'actor-101003',
      switches: [switchAction('switch-1', 1000, 101003, 101007)],
    });
    expect(result.summary).toMatchObject({
      switchEventCount: 1,
      appliedBindingCount: 2,
      derivedActionCount: 2,
      onEnterDerivedActionCount: 1,
      onExitDerivedActionCount: 1,
    });
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: 'actor-101003',
          skillId: 10100322,
          durationFrames: 140,
          startMs: 1000,
          parentActionId: 'switch-1',
          readOnly: true,
          switchTriggerBinding: expect.objectContaining({
            triggerPhase: 'on-exit',
          }),
        }),
        expect.objectContaining({
          actorId: 'actor-101007',
          skillId: 10100721,
          durationFrames: 365,
          startMs: 1000,
          parentActionId: 'switch-1',
          readOnly: true,
          switchTriggerBinding: expect.objectContaining({
            triggerPhase: 'on-enter',
          }),
        }),
      ])
    );
  });

  it('does not invent a child for a source gap or initial front actor', () => {
    expect(
      generate({
        actors: [actor(101007)],
        initialActorId: 'actor-101007',
        switches: [],
      }).actions
    ).toEqual([]);
    const result = generate({
      actors: [actor(102001), actor(101003)],
      initialActorId: 'actor-102001',
      switches: [switchAction('switch-gap', 1000, 102001, 101003)],
    });
    expect(result.actions).toEqual([]);
    expect(result.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          starCarryOwnerCharacterId: 102001,
          resolutionStatus: 'static-evidence-gap',
          applied: false,
        }),
      ])
    );
  });

  it('rejects later same-frame switches and keeps child identities parent-bound', () => {
    const actors = [actor(101003), actor(101007), actor(103002)];
    const first = switchAction('switch-a', 1000, 101003, 101007);
    const second = switchAction('switch-b', 1000, 101003, 103002);
    const result = generate({
      actors,
      initialActorId: 'actor-101003',
      switches: [second, first],
    });
    expect(
      result.actions.every(action => action.parentActionId === 'switch-a')
    ).toBe(true);
    expect(result.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          switchEventId: 'switch-b',
          resolutionStatus: 'parent-switch-rejected',
          reasons: ['parent-switch-frame-conflict'],
        }),
      ])
    );
  });

  it('moves and copies all child timing from the parent identity', () => {
    const actors = [actor(101003), actor(101007)];
    const moved = generate({
      actors,
      initialActorId: 'actor-101003',
      switches: [switchAction('switch-moved', 2000, 101003, 101007)],
    });
    expect(moved.actions.map(action => action.startMs)).toEqual([2000, 2000]);
    expect(
      moved.actions.every(action => action.id.includes('switch-moved'))
    ).toBe(true);
  });

  it('projects persisted parent hit overrides onto the read-only child action', () => {
    const hitOverrides = {
      'verified-child-hit': { willHit: false },
    };
    const result = generate({
      actors: [actor(103002), actor(101010)],
      initialActorId: 'actor-103002',
      switches: [
        switchAction('switch-with-hit-mask', 1000, 103002, 101010, {
          hitOverrides,
        }),
      ],
    });
    const child = result.actions.find(
      action =>
        action.parentActionId === 'switch-with-hit-mask' &&
        action.actorId === 'actor-101010'
    );

    expect(child).toMatchObject({
      skillId: 10101021,
      hitOverrides,
      derivedAction: {
        parentActionId: 'switch-with-hit-mask',
        readOnly: true,
      },
    });
  });

  it('suppresses cooldown-active star-carry materialization without creating an occupying action', () => {
    const actors = [actor(101003), actor(101007)];
    const result = generate({
      actors,
      initialActorId: 'actor-101003',
      switches: [
        switchAction('switch-first', 1000, 101003, 101007),
        switchAction('switch-reset', 2000, 101007, 101003),
        switchAction('switch-during-cooldown', 3000, 101003, 101007),
        switchAction('switch-reset-after-cooldown', 4000, 101007, 101003),
        switchAction('switch-after-cooldown', 26_000, 101003, 101007),
      ],
    });

    expect(
      result.actions.filter(
        action => action.parentActionId === 'switch-during-cooldown'
      )
    ).toEqual([]);
    expect(result.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          switchEventId: 'switch-during-cooldown',
          starCarryOwnerCharacterId: 101003,
          resolutionStatus: 'suppressed-cooldown-active',
          materializationStatus: 'not-materialized',
          cooldownRemainingMs: 22_000,
          applied: false,
        }),
      ])
    );
    expect(
      result.actions.filter(
        action => action.parentActionId === 'switch-after-cooldown'
      )
    ).toHaveLength(2);
    expect(result.summary).toMatchObject({
      derivedActionCount: 4,
      cooldownSuppressedBindingCount: 2,
    });
  });

  it('applies the same cooldown gate to a synthetic owner without generator branches', () => {
    const first = resolveSwitchTriggeredCooldownGate({
      ownerId: 'synthetic-owner',
      actionIdentity: 'synthetic-star-carry',
      startMs: 1000,
      cooldownDurationMs: 24_000,
      cooldownSourceIdentity: 'synthetic-source',
    });
    expect(first).toMatchObject({
      status: 'materialized-with-cooldown',
      nextReadyAtMs: 25_000,
    });

    expect(
      resolveSwitchTriggeredCooldownGate({
        ownerId: 'synthetic-owner',
        actionIdentity: 'synthetic-star-carry',
        startMs: 9000,
        cooldownDurationMs: 24_000,
        cooldownSourceIdentity: 'synthetic-source',
        readyAtMs: first.nextReadyAtMs,
      })
    ).toMatchObject({
      status: 'suppressed-cooldown-active',
      cooldownReadyAtMs: 25_000,
      cooldownRemainingMs: 16_000,
      nextReadyAtMs: 25_000,
    });
  });
});

function generate({ actors, initialActorId, switches }) {
  return createSwitchTriggeredActionGeneration({
    actions: switches,
    actors,
    team: {
      slots: actors.map((item, position) => ({
        position,
        actorId: item.id,
        characterId: item.characterId,
      })),
    },
    initialRuntimeState: {
      controlledActor: { actorId: initialActorId },
    },
    time: { fps: 60, durationMs: 30000 },
    skillsById,
    targetId: 'enemy-1',
  });
}

function actor(characterId) {
  const character = seed.gameData.characters.find(
    item => Number(item.id) === Number(characterId)
  );
  return {
    id: `actor-${characterId}`,
    characterId,
    name: character?.name ?? String(characterId),
  };
}

function switchAction(
  id,
  startMs,
  sourceCharacterId,
  targetCharacterId,
  { hitOverrides = null } = {}
) {
  return createSwitchAction({
    id,
    actorId: `actor-${sourceCharacterId}`,
    targetActorId: `actor-${targetCharacterId}`,
    targetCharacterId,
    startMs,
    hitOverrides,
  });
}
