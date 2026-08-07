import { describe, expect, it } from 'vitest';
import { expandKiboAutoCastActions } from '../../machine-axis/kiboAutoCastScheduler';

const KIBO_CATALOG = new Map([
  [
    500001,
    {
      kiboId: 500001,
      actions: [
        {
          skillId: 50000102,
          kind: 'signature',
          durationFrames: 85,
          cooldownMs: 18000,
          selfCooldownMs: null,
          selfCooldownGroup: null,
          gcdMs: null,
          petSkillLogicTag: '-1',
        },
        {
          skillId: 504003,
          kind: 'normal-attack',
          durationFrames: 150,
          cooldownMs: 3000,
          selfCooldownMs: 4000,
          selfCooldownGroup: 50000,
          gcdMs: 2000,
          petSkillLogicTag: '0',
        },
        {
          skillId: 504004,
          kind: 'active',
          durationFrames: 220,
          cooldownMs: 8000,
          selfCooldownMs: 4000,
          selfCooldownGroup: 50000,
          gcdMs: 2000,
          petSkillLogicTag: '0',
        },
        {
          skillId: 50000112,
          kind: 'break',
          durationFrames: 90,
          cooldownMs: 5000,
          selfCooldownMs: null,
          selfCooldownGroup: null,
          gcdMs: null,
          petSkillLogicTag: '-1',
        },
      ],
    },
  ],
  [
    500002,
    {
      kiboId: 500002,
      actions: [
        {
          skillId: 50000202,
          kind: 'signature',
          durationFrames: 80,
          cooldownMs: 18000,
          selfCooldownMs: null,
          selfCooldownGroup: null,
          gcdMs: null,
          petSkillLogicTag: '-1',
        },
        {
          skillId: 502015,
          kind: 'normal-attack',
          durationFrames: 100,
          cooldownMs: 1000,
          selfCooldownMs: null,
          selfCooldownGroup: null,
          gcdMs: null,
          petSkillLogicTag: '10|7',
        },
        {
          skillId: 50000203,
          kind: 'break',
          durationFrames: 90,
          cooldownMs: 5000,
          selfCooldownMs: null,
          selfCooldownGroup: null,
          gcdMs: null,
          petSkillLogicTag: '-1',
        },
      ],
    },
  ],
]);

function createContract({ kiboId = 500001, actions = [] } = {}) {
  return {
    scenario: {
      durationFrames: 2000,
      team: [
        {
          slotId: 'slot-1',
          characterId: 103002,
          loadout: { kiboId },
        },
      ],
    },
    actions,
  };
}

function createKiboAction({ id, frame, skillId, actionKind }) {
  return {
    id,
    owner: { kind: 'kibo', slotId: 'slot-1' },
    intent: {
      kind: 'public-action',
      publicActionId: skillId,
      actionKind,
      level: 1,
    },
    schedule: { mode: 'absolute', frame },
  };
}

describe('kibo auto-cast scheduler', () => {
  it('fills normal-attack and active casts around a dragged kibo signature', () => {
    const expanded = expandKiboAutoCastActions(
      createContract({
        actions: [
          createKiboAction({
            id: 'xunlang-signature',
            frame: 600,
            skillId: 50000102,
            actionKind: 'signature',
          }),
        ],
      }),
      { kiboCatalogById: KIBO_CATALOG }
    );
    const autoActions = expanded.filter(action => action.autoCast === true);

    expect(autoActions.map(action => action.intent.actionKind)).toEqual([
      'active',
      'normal-attack',
      'active',
      'normal-attack',
      'active',
      'normal-attack',
      'active',
    ]);
    expect(autoActions.map(action => action.schedule.frame)).toEqual([
      0, 240, 685, 925, 1165, 1405, 1645,
    ]);
    expect(
      autoActions.every(
        action =>
          action.owner.kind === 'kibo' &&
          action.owner.slotId === 'slot-1' &&
          action.intent.autoCast === true
      )
    ).toBe(true);
    expect(
      autoActions.every(
        action =>
          action.schedule.frame + 220 <= 600 ||
          action.schedule.frame >= 685
      )
    ).toBe(true);
    expect(autoActions[0].autoCastRule).toMatchObject({
      source: 'azpr-kibo-auto-cast',
      trigger: 'unconditional',
      priority: 'active-before-normal',
      evidenceStatus: 'static-evidence-closed',
    });
    expect(expanded).toHaveLength(1 + autoActions.length);
  });

  it('marks event-triggered normal attacks as planner-simplified', () => {
    const expanded = expandKiboAutoCastActions(
      createContract({
        kiboId: 500002,
        actions: [
          createKiboAction({
            id: 'water-signature',
            frame: 0,
            skillId: 50000202,
            actionKind: 'signature',
          }),
        ],
      }),
      { kiboCatalogById: KIBO_CATALOG }
    );
    const autoActions = expanded.filter(action => action.autoCast === true);
    expect(autoActions.length).toBeGreaterThan(0);
    expect(
      autoActions.every(action => action.intent.actionKind === 'normal-attack')
    ).toBe(true);
    expect(autoActions[0].autoCastRule).toMatchObject({
      trigger: 'event-triggered',
      triggerTag: '10|7',
      evidenceStatus: 'planner-simplified',
    });
  });

  it('does not add auto casts when no kibo action is dragged', () => {
    const expanded = expandKiboAutoCastActions(createContract(), {
      kiboCatalogById: KIBO_CATALOG,
    });
    expect(expanded).toEqual([]);
  });
});
