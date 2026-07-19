import { describe, expect, it } from 'vitest';
import {
  ACTION_RULE_CODES,
  ACTION_RULE_DIAGNOSTICS_CONTRACT_NAME,
  createActionRuleDiagnostics,
} from '../../simulation/runtime/actionRuleDiagnostics';

describe('action rule diagnostics', () => {
  it('reports actor-lane overlap, confirmed cooldown violations, and unapplied preview SP costs', () => {
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
        diagnosticCount: 3,
        violationCount: 2,
        unresolvedCount: 1,
        laneOverlapCount: 1,
        cooldownViolationCount: 1,
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
          code: ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE,
          actionId: 'action-2',
          blockingActionId: 'action-1',
          cooldownMs: 5000,
          readyAtMs: 5000,
          remainingMs: 4500,
          suggestedStartMs: 5000,
          source: expect.objectContaining({
            fieldPath: 'skillsub_logic.rows[skillId=1001].coolDown',
          }),
        }),
        expect.objectContaining({
          code: ACTION_RULE_CODES.SKILL_SP_PRECONDITION_UNRESOLVED,
          actionId: 'action-3',
          requiredSp: 100,
          actorInitialSp: 50,
          actorMaxSp: 100,
          severity: 'warning',
          unresolved: ['skill-sp-cost-not-applied-by-selected-profile'],
          message:
            '星决技 需要 SP 100，当前 50/100；当前机制配置未应用该消耗',
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
        cooldownTrackedActionCount: 2,
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
        violationCodes: expect.arrayContaining([
          ACTION_RULE_CODES.LANE_OVERLAP,
          ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE,
        ]),
        cooldown: expect.objectContaining({
          status: 'blocked-no-charge-ready',
          availableBefore: 0,
          availableAfter: 0,
          windowId: null,
        }),
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
  };
}
