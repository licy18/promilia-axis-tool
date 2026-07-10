import { describe, expect, it } from 'vitest';
import {
  ACTION_RULE_CODES,
  ACTION_RULE_DIAGNOSTICS_CONTRACT_NAME,
  createActionRuleDiagnostics,
} from '../../simulation/runtime/actionRuleDiagnostics';

describe('action rule diagnostics', () => {
  it('reports actor-lane overlap, confirmed cooldown violations, and unresolved SP units', () => {
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
          requiredSpRaw: 100,
          actorInitialSp: 0.5,
          actorMaxSp: 1,
          severity: 'warning',
          unresolved: ['skill-sp-cost-to-runtime-energy-unit'],
        }),
      ])
    );
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

    const cooldownRows = createActionRuleDiagnostics({
      scenario,
    }).diagnostics.filter(
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
    initialSp: 0.5,
    stats: { maxSp: 1 },
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
