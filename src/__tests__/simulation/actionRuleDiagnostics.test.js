import { describe, expect, it } from 'vitest';
import {
  ACTION_RULE_CODES,
  ACTION_RULE_DIAGNOSTICS_CONTRACT_NAME,
  createActionRuleDiagnostics,
} from '../../simulation/runtime/actionRuleDiagnostics';
import { frameToMs } from '../../domain/timebase';

describe('action rule diagnostics', () => {
  it('reports actor-lane overlap without consuming cooldown and keeps unapplied preview SP costs unresolved', () => {
    const scenario = {
      actors: [createActor()],
      actions: [
        createSkillAction({
          id: 'action-1',
          skillId: 1001,
          name: '星鸣技',
          startMs: 0,
          durationMs: 1000,
          cooldownMs: 5000,
        }),
        createSkillAction({
          id: 'action-2',
          skillId: 1001,
          name: '星鸣技',
          startMs: 500,
          durationMs: 1000,
          cooldownMs: 5000,
        }),
        createSkillAction({
          id: 'action-3',
          skillId: 1002,
          name: '星决技',
          startMs: 2000,
          durationMs: 800,
          spCost: 100,
        }),
      ],
    };

    const result = createActionRuleDiagnostics({ scenario });

    expect(result).toMatchObject({
      contractName: ACTION_RULE_DIAGNOSTICS_CONTRACT_NAME,
      status: 'action-rules-violated',
      executable: false,
      summary: {
        diagnosticCount: 2,
        violationCount: 1,
        unresolvedCount: 1,
        laneOverlapCount: 1,
        cooldownViolationCount: 0,
        unresolvedSpPreconditionCount: 1,
        appliedToSimulationResults: false,
      },
      appliedToSimulationResults: false,
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.LANE_OVERLAP,
          actionId: 'action-2',
          blockingActionId: 'action-1',
          suggestedStartMs: 1000,
          editFieldKey: 'startMs',
          severity: 'error',
        }),
        expect.objectContaining({
          code: ACTION_RULE_CODES.SKILL_SP_PRECONDITION_UNRESOLVED,
          actionId: 'action-3',
          requiredSp: 100,
          actorInitialSp: 50,
          actorMaxSp: 100,
          severity: 'warning',
          unresolved: ['skill-sp-cost-not-applied-by-selected-profile'],
          message: '星决技 需要 SP 100，当前 50/100；当前机制配置未应用该消耗',
        }),
      ])
    );
    expect(result.readinessTimeline).toMatchObject({
      contractName: 'AzPrActionReadinessTimeline',
      status: 'action-readiness-timeline-ready-with-blocked-actions',
      summary: {
        actionCount: 3,
        readyActionCount: 1,
        blockedActionCount: 1,
        unresolvedActionCount: 1,
        cooldownTrackedActionCount: 1,
        cooldownWindowCount: 1,
        appliedToSimulationResults: false,
      },
      cooldownWindows: [
        {
          actionId: 'action-1',
          chargeIndex: 0,
          startMs: 0,
          endMs: 5000,
        },
      ],
    });
    expect(result.readinessTimeline.actions).toEqual([
      expect.objectContaining({
        actionId: 'action-1',
        status: 'ready',
        executable: true,
        cooldown: expect.objectContaining({
          availableBefore: 1,
          availableAfter: 0,
          nextReadyAtMs: 5000,
        }),
      }),
      expect.objectContaining({
        actionId: 'action-2',
        status: 'blocked',
        executable: false,
        violationCodes: [ACTION_RULE_CODES.LANE_OVERLAP],
        cooldown: null,
      }),
      expect.objectContaining({
        actionId: 'action-3',
        status: 'ready-with-unresolved-conditions',
        executable: true,
        unresolvedCodes: [ACTION_RULE_CODES.SKILL_SP_PRECONDITION_UNRESOLVED],
      }),
    ]);
  });

  it('does not let an invalid cooldown cast restart the cooldown window', () => {
    const scenario = {
      actors: [createActor()],
      actions: [
        createSkillAction({ id: 'action-1', startMs: 0, cooldownMs: 5000 }),
        createSkillAction({ id: 'action-2', startMs: 1000, cooldownMs: 5000 }),
        createSkillAction({ id: 'action-3', startMs: 4000, cooldownMs: 5000 }),
        {
          id: 'annotation-1',
          type: 'annotation',
          startMs: 0,
          durationMs: 10000,
          name: '说明',
        },
      ],
    };

    const result = createActionRuleDiagnostics({ scenario });
    const cooldownRows = result.diagnostics.filter(
      item => item.code === ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE
    );

    expect(cooldownRows).toHaveLength(2);
    expect(cooldownRows.map(item => item.readyAtMs)).toEqual([5000, 5000]);
    expect(
      result.diagnostics.some(item => item.actionId === 'annotation-1')
    ).toBe(false);
  });

  it('keeps exact-frame switches out of occupancy and resolves same-frame conflicts stably', () => {
    const actor = createActor();
    const createSwitch = (id, targetActorId) => ({
      id,
      type: 'switch',
      name: `切人 ${id}`,
      actorId: actor.id,
      actor,
      targetActorId,
      startMs: 1000,
      startFrame: 60,
      endFrame: 60,
      durationMs: 0,
      durationFrames: 0,
    });
    const result = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [actor],
        actions: [
          createSwitch('switch-z', 'actor-3'),
          createSkillAction({
            id: 'skill-at-switch-frame',
            startMs: 1000,
            durationMs: 1000,
          }),
          createSwitch('switch-a', 'actor-2'),
        ],
      },
    });

    expect(result.summary).toMatchObject({
      laneOverlapCount: 0,
      switchFrameConflictCount: 1,
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: ACTION_RULE_CODES.SWITCH_FRAME_CONFLICT,
        actionId: 'switch-a',
        blockingActionId: 'switch-z',
        frameIndex: 60,
        suggestedStartMs: frameToMs(61),
      }),
    ]);
    expect(
      result.readinessTimeline.actions.find(
        action => action.actionId === 'switch-z'
      )
    ).toMatchObject({ executable: true, status: 'ready' });
    expect(
      result.readinessTimeline.actions.find(
        action => action.actionId === 'switch-a'
      )
    ).toMatchObject({ executable: false, status: 'blocked' });
  });

  it('requires an equipped kibo and a same-frame joint attack pair', () => {
    const actor = {
      ...createActor(),
      loadout: { kiboId: 500001 },
    };
    const createActorCombo = startMs =>
      createSkillAction({
        id: 'actor-combo',
        skillId: 10100712,
        name: '星结合击',
        actionKind: 'star-combo',
        actor,
        startMs,
      });
    const createKiboCombo = startMs => ({
      id: 'kibo-combo',
      type: 'kiboEvent',
      skillId: 50000112,
      name: '迅狼-合击',
      eventType: 'break',
      actorId: actor.id,
      actor,
      kiboId: 500001,
      startMs,
      durationMs: 500,
    });

    const valid = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [actor],
        actions: [
          createActorCombo(frameToMs(120)),
          createKiboCombo(frameToMs(120)),
        ],
      },
    });
    expect(valid.summary.jointAttackViolationCount).toBe(0);
    expect(
      valid.readinessTimeline.actions.every(action => action.executable)
    ).toBe(true);

    const mismatched = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [actor],
        actions: [
          createActorCombo(frameToMs(120)),
          createKiboCombo(frameToMs(121)),
        ],
      },
    });
    expect(
      mismatched.diagnostics.filter(
        item => item.code === ACTION_RULE_CODES.JOINT_ATTACK_FRAME_MISMATCH
      )
    ).toHaveLength(2);
    expect(
      mismatched.readinessTimeline.actions.every(
        action => action.executable === false
      )
    ).toBe(true);

    const actorWithoutKibo = { ...actor, loadout: { kiboId: null } };
    const missingKibo = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [actorWithoutKibo],
        actions: [
          createSkillAction({
            id: 'actor-combo-without-kibo',
            skillId: 10100712,
            name: '星结合击',
            actionKind: 'star-combo',
            actor: actorWithoutKibo,
            startMs: frameToMs(120),
          }),
        ],
      },
    });
    expect(missingKibo.diagnostics).toEqual([
      expect.objectContaining({
        code: ACTION_RULE_CODES.JOINT_ATTACK_KIBO_REQUIRED,
        actionId: 'actor-combo-without-kibo',
      }),
    ]);
    expect(missingKibo.readinessTimeline.actions[0]).toMatchObject({
      executable: false,
      status: 'blocked',
    });
  });

  it('consumes configured cooldown charges before reporting a violation', () => {
    const scenario = {
      actors: [createActor()],
      actions: [
        createSkillAction({
          id: 'action-1',
          startMs: 0,
          durationMs: 100,
          cooldownMs: 5000,
          cooldownCount: 2,
        }),
        createSkillAction({
          id: 'action-2',
          startMs: 1000,
          durationMs: 100,
          cooldownMs: 5000,
          cooldownCount: 2,
        }),
        createSkillAction({
          id: 'action-3',
          startMs: 2000,
          durationMs: 100,
          cooldownMs: 5000,
          cooldownCount: 2,
        }),
        createSkillAction({
          id: 'action-4',
          startMs: 5000,
          durationMs: 100,
          cooldownMs: 5000,
          cooldownCount: 2,
        }),
      ],
    };

    const result = createActionRuleDiagnostics({ scenario });
    const cooldownRows = result.diagnostics.filter(
      item => item.code === ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE
    );

    expect(cooldownRows).toEqual([
      expect.objectContaining({
        actionId: 'action-3',
        blockingActionId: 'action-1',
        cooldownCount: 2,
        readyAtMs: 5000,
      }),
    ]);
    expect(result.readinessTimeline.cooldownWindows).toEqual([
      expect.objectContaining({
        actionId: 'action-1',
        chargeIndex: 0,
        startMs: 0,
        endMs: 5000,
      }),
      expect.objectContaining({
        actionId: 'action-2',
        chargeIndex: 1,
        startMs: 1000,
        endMs: 6000,
      }),
      expect.objectContaining({
        actionId: 'action-4',
        chargeIndex: 0,
        startMs: 5000,
        endMs: 10000,
      }),
    ]);
    expect(
      result.readinessTimeline.actions.find(
        action => action.actionId === 'action-3'
      )
    ).toMatchObject({
      status: 'blocked',
      cooldown: {
        status: 'blocked-no-charge-ready',
        availableBefore: 0,
        availableAfter: 0,
        nextReadyAtMs: 5000,
      },
    });
  });

  it('returns an executable ready contract when no checked rule is violated', () => {
    const result = createActionRuleDiagnostics({
      scenario: {
        actors: [createActor()],
        actions: [
          createSkillAction({ id: 'action-1', startMs: 0, cooldownMs: 5000 }),
          createSkillAction({
            id: 'action-2',
            startMs: 5000,
            cooldownMs: 5000,
          }),
        ],
      },
    });

    expect(result).toMatchObject({
      status: 'action-rules-ready',
      executable: true,
      diagnostics: [],
      summary: {
        violationCount: 0,
        unresolvedCount: 0,
      },
    });
  });

  it('diagnoses deleted and reordered normal attack inputs without repairing the chain', () => {
    const result = createActionRuleDiagnostics({
      scenario: {
        actors: [createActor()],
        actions: [
          createSkillAction({
            id: 'attack-a1',
            name: 'A1',
            startMs: 0,
            attackGroupId: 'attack-group-1',
            attackSequenceIndex: 1,
            attackSequenceTotal: 4,
          }),
          createSkillAction({
            id: 'attack-a2',
            name: 'A2',
            startMs: 2000,
            attackGroupId: 'attack-group-1',
            attackSequenceIndex: 2,
            attackSequenceTotal: 4,
          }),
          createSkillAction({
            id: 'attack-a4',
            name: 'A4',
            startMs: 1000,
            attackGroupId: 'attack-group-1',
            attackSequenceIndex: 4,
            attackSequenceTotal: 4,
          }),
        ],
      },
    });

    expect(result.executable).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_INCOMPLETE,
          missingSequenceIndexes: [3],
          actionIds: ['attack-a1', 'attack-a2', 'attack-a4'],
        }),
        expect.objectContaining({
          code: ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_ORDER_INVALID,
          actionId: 'attack-a4',
        }),
      ])
    );
    expect(result.readinessTimeline.actions).toHaveLength(3);
  });

  it('keeps free placement while diagnosing real normal-attack input windows', () => {
    const createPair = ({
      groupId,
      baseFrame,
      nextFrame,
      status = 'applied',
    }) => [
      createSkillAction({
        id: `${groupId}-a1`,
        name: 'A1',
        startMs: frameToMs(baseFrame),
        durationMs: frameToMs(5),
        attackGroupId: groupId,
        attackSequenceIndex: 1,
        attackSequenceTotal: 2,
        attackInput: {
          linkTimingStatus: status,
          linkTimingReasons:
            status === 'applied'
              ? []
              : ['next-control-event-bridge-window-unavailable'],
          linkWindow:
            status === 'applied' ? { startFrame: 19, endFrame: 46 } : null,
        },
      }),
      createSkillAction({
        id: `${groupId}-a2`,
        name: 'A2',
        startMs: frameToMs(baseFrame + nextFrame),
        durationMs: frameToMs(5),
        attackGroupId: groupId,
        attackSequenceIndex: 2,
        attackSequenceTotal: 2,
      }),
    ];
    const result = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [createActor()],
        actions: [
          ...createPair({ groupId: 'early', baseFrame: 0, nextFrame: 10 }),
          ...createPair({ groupId: 'valid', baseFrame: 100, nextFrame: 19 }),
          ...createPair({ groupId: 'late', baseFrame: 200, nextFrame: 50 }),
          ...createPair({
            groupId: 'unknown',
            baseFrame: 300,
            nextFrame: 20,
            status: 'unresolved',
          }),
        ],
      },
    });

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.ATTACK_INPUT_LINK_TOO_EARLY,
          actionId: 'early-a2',
          relativeStartFrame: 10,
        }),
        expect.objectContaining({
          code: ACTION_RULE_CODES.ATTACK_INPUT_LINK_TOO_LATE,
          actionId: 'late-a2',
          relativeStartFrame: 50,
        }),
        expect.objectContaining({
          code: ACTION_RULE_CODES.ATTACK_INPUT_LINK_TIMING_UNRESOLVED,
          actionId: 'unknown-a1',
        }),
      ])
    );
    expect(result.diagnostics.some(item => item.actionId === 'valid-a2')).toBe(
      false
    );
    expect(result.executable).toBe(true);
  });
});

function createActor() {
  return {
    id: 'actor-1',
    name: '测试角色',
    initialSp: 50,
    stats: { maxSp: 100 },
  };
}

function createSkillAction({
  id,
  skillId = 1001,
  name = '星鸣技',
  startMs,
  durationMs = 500,
  cooldownMs = 0,
  cooldownCount = 1,
  spCost = 0,
  ...extra
}) {
  return {
    id,
    type: 'skill',
    skillId,
    name,
    actorId: 'actor-1',
    actor: createActor(),
    startMs,
    durationMs,
    logicModel: {
      status: 'mapped',
      logic: {
        sourceKind: 'azpr-newtable-skill-logic-index',
        subSkillId: skillId,
        cooldownMs,
        cooldownCount,
        spCost,
        fieldPaths: {
          cooldownMs: `skillsub_logic.rows[skillId=${skillId}].coolDown`,
          spCost: `skillsub_logic.rows[skillId=${skillId}].spCost`,
        },
      },
    },
    ...extra,
  };
}
