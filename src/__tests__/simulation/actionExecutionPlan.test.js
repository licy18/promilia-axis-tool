import { describe, expect, it } from 'vitest';
import {
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import {
  ACTION_EXECUTION_PLAN_CONTRACT_NAME,
  ACTION_EXECUTION_STATUSES,
  createActionExecutionPlan,
  runSimulation,
} from '../../simulation';
import { createActionRuleDiagnostics } from '../../simulation/runtime/actionRuleDiagnostics';

describe('action execution plan', () => {
  it('schedules unresolved actions but skips confirmed rule violations', () => {
    const scenario = {
      actors: [createActor()],
      actions: [
        createSkillAction({ id: 'action-1', startMs: 0, cooldownMs: 5000 }),
        createSkillAction({
          id: 'action-2',
          startMs: 1000,
          cooldownMs: 5000,
        }),
        createSkillAction({
          id: 'action-3',
          skillId: 1002,
          startMs: 2000,
          cooldownMs: 0,
          spCost: 100,
        }),
      ],
    };
    const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });

    const plan = createActionExecutionPlan({
      scenario,
      actionRuleDiagnostics,
    });

    expect(plan).toMatchObject({
      contractName: ACTION_EXECUTION_PLAN_CONTRACT_NAME,
      status: 'action-execution-plan-ready-with-skipped-actions',
      executedActionIds: ['action-1', 'action-3'],
      skippedActionIds: ['action-2'],
      unresolvedExecutedActionIds: ['action-3'],
      summary: {
        actionCount: 3,
        executedActionCount: 2,
        skippedActionCount: 1,
        unresolvedExecutedActionCount: 1,
        appliedToSimulationResults: true,
      },
      appliedToSimulationResults: true,
    });
    expect(plan.actions).toEqual([
      expect.objectContaining({
        actionId: 'action-1',
        status: ACTION_EXECUTION_STATUSES.SCHEDULED,
        execute: true,
        executionIndex: 0,
      }),
      expect.objectContaining({
        actionId: 'action-2',
        status: ACTION_EXECUTION_STATUSES.SKIPPED_RULE_BLOCKED,
        execute: false,
        executionIndex: null,
        skipReason: 'confirmed-action-rule-violation',
      }),
      expect.objectContaining({
        actionId: 'action-3',
        status: ACTION_EXECUTION_STATUSES.SCHEDULED_WITH_UNRESOLVED_CONDITIONS,
        execute: true,
        executionIndex: 1,
      }),
    ]);
  });

  it('excludes a blocked cast from events, effects, generation, and runtime', () => {
    const actions = [
      createWorkbenchActionDraft({
        id: 'action-1',
        skillId: 10900112,
        startMs: 0,
        durationMs: 1000,
      }),
      createWorkbenchActionDraft({
        id: 'action-2',
        skillId: 10900112,
        startMs: 2500,
        durationMs: 1000,
      }),
      createWorkbenchActionDraft({
        id: 'action-3',
        skillId: 10900112,
        startMs: 5000,
        durationMs: 1000,
        effectCommands: [
          {
            id: 'blocked-effect-command',
            effectId: 'blocked-effect',
            effectName: '阻塞动作效果',
            operation: 'apply',
            targetKind: 'enemy',
            offsetMs: 0,
            durationMs: 1000,
            stackMode: 'refresh',
            stackDelta: 1,
            maxStacks: 1,
          },
        ],
      }),
    ];
    const project = createWorkbenchProject({ skillId: 10900112 }, { actions });

    const result = runSimulation(project, getWorkbenchGameData());

    expect(result.actionExecutionPlan).toMatchObject({
      executedActionIds: ['action-1', 'action-2'],
      skippedActionIds: ['action-3'],
      summary: {
        actionCount: 3,
        executedActionCount: 2,
        skippedActionCount: 1,
      },
    });
    expect(result.scenario).toMatchObject({
      actionCount: 3,
      executedActionCount: 2,
      skippedActionCount: 1,
    });
    expect(result.summary).toMatchObject({
      actionCount: 3,
      executedActionCount: 2,
      skippedActionCount: 1,
      actionResultCount: 2,
    });
    expect(
      result.eventLog.find(
        event =>
          event.type === 'ACTION_SKIPPED' && event.actionId === 'action-3'
      )
    ).toMatchObject({
      payload: {
        reason: 'confirmed-action-rule-violation',
        executionStatus: ACTION_EXECUTION_STATUSES.SKIPPED_RULE_BLOCKED,
        readinessStatus: 'blocked',
        violationCodes: ['skill-cooldown-active'],
      },
    });
    expect(
      result.eventLog.some(
        event => event.type === 'ACTION_START' && event.actionId === 'action-3'
      )
    ).toBe(false);
    expect(result.actionResultTimeline.map(entry => entry.actionId)).toEqual([
      'action-1',
      'action-2',
    ]);
    expect(
      result.threeValueGenerationBundle.actions.map(action => action.actionId)
    ).toEqual(['action-1', 'action-2']);
    expect(
      result.threeValueRuntimeProjection.runtimeAppliedDeltas.some(
        delta => delta.actionId === 'action-3'
      )
    ).toBe(false);
    expect(result.effectTimeline).toMatchObject({
      events: [],
      summary: {
        inputCommandCount: 1,
        executableInputCommandCount: 0,
        blockedCommandCount: 1,
        commandCount: 0,
        eventCount: 0,
      },
    });
    expect(result.runtimeOutputs.summary).toMatchObject({
      executionPlanActionCount: 3,
      executionPlanExecutedActionCount: 2,
      executionPlanSkippedActionCount: 1,
    });
    expect(result.runtimeOutputs.outputConsistency).toMatchObject({
      status: 'runtime-output-consistent',
      consistent: true,
      checks: {
        summaryExecutionPlanCounts: true,
        outputContractExecutionPlanCounts: true,
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
  startMs,
  cooldownMs,
  spCost = 0,
}) {
  return {
    id,
    type: 'skill',
    skillId,
    name: '测试技能',
    actorId: 'actor-1',
    actor: createActor(),
    startMs,
    durationMs: 100,
    logicModel: {
      logic: {
        sourceKind: 'test-skill-logic',
        cooldownMs,
        cooldownCount: 1,
        spCost,
        fieldPaths: {
          cooldownMs: `skillsub_logic.rows[skillId=${skillId}].coolDown`,
          spCost: `skillsub_logic.rows[skillId=${skillId}].spCost`,
        },
      },
    },
  };
}
