import { describe, expect, it } from 'vitest';
import { WORKBENCH_ACTION_EDIT_FLOW_PLAN_KINDS } from '../../features/workbench/workbenchActionEditFlowPlan';
import {
  WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS,
  createWorkbenchFlowPlanController,
} from '../../features/workbench/workbenchFlowPlanController';
import {
  WORKBENCH_RUNTIME_FLOW_PLAN_KINDS,
  WORKBENCH_RUNTIME_FLOW_PLAN_MODES,
} from '../../features/workbench/workbenchRuntimeFlowPlan';

describe('workbench flow plan controller', () => {
  it('centralizes runtime entry and runtime result return plan creation', () => {
    const controller = createWorkbenchFlowPlanController({
      getRuntimeProjection: () => createRuntimeProjectionFixture(),
      getSelectedActionId: () => 'action-0002',
    });

    expect(
      controller[
        WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_ENTRY
      ]()
    ).toMatchObject({
      kind: WORKBENCH_RUNTIME_FLOW_PLAN_KINDS.RUNTIME_ENTRY,
      mode: WORKBENCH_RUNTIME_FLOW_PLAN_MODES.RUNTIME_RESULT,
      actionId: 'action-0002',
      routeSource: 'selected-action-runtime-point',
      statePointId: 'selfEnergyChange|applied|action-0002|30|1',
    });

    expect(
      controller[
        WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_ENTRY
      ]({
        actionId: 'action-missing',
        fallbackToFirstRuntimePoint: true,
      })
    ).toMatchObject({
      kind: WORKBENCH_RUNTIME_FLOW_PLAN_KINDS.RUNTIME_ENTRY,
      mode: WORKBENCH_RUNTIME_FLOW_PLAN_MODES.RUNTIME_RESULT,
      actionId: 'action-missing',
      routeSource: 'first-runtime-point',
      statePointId: 'enemyHpDamage|applied|action-0001|12|0',
    });

    expect(
      controller[
        WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_RESULT_RETURN
      ]({
        actionId: 'action-0001',
        statePointId: 'enemyHpDamage|applied|action-0001|12|0',
      })
    ).toMatchObject({
      kind: WORKBENCH_RUNTIME_FLOW_PLAN_KINDS.RUNTIME_RESULT_RETURN,
      mode: WORKBENCH_RUNTIME_FLOW_PLAN_MODES.RUNTIME_RESULT,
      actionId: 'action-0001',
      selectActionId: 'action-0001',
      statePointId: 'enemyHpDamage|applied|action-0001|12|0',
      runtimeLogFocusSource: 'action-result',
    });
  });

  it('centralizes runtime point focus and action edit focus plan creation', () => {
    const controller = createWorkbenchFlowPlanController({
      getActionEditFocusSequence: () => 9,
    });

    expect(
      controller[
        WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_POINT_FOCUS
      ]({
        statePointId: 'enemyHpDamage|applied|action-0001|12|0',
        source: 'action-contribution',
      })
    ).toMatchObject({
      kind: WORKBENCH_RUNTIME_FLOW_PLAN_KINDS.RUNTIME_POINT_FOCUS,
      statePointId: 'enemyHpDamage|applied|action-0001|12|0',
      runtimeLogFocusSource: 'action-contribution',
    });

    expect(
      controller[
        WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_ACTION_EDIT_FOCUS
      ]({
        actionId: 'action-0001',
        frameLabel: '12f',
        statePointId: 'enemyHpDamage|applied|action-0001|12|0',
        trackKey: 'enemyHpDamage',
        source: 'runtime-detail',
      })
    ).toMatchObject({
      kind: WORKBENCH_ACTION_EDIT_FLOW_PLAN_KINDS.RUNTIME_ACTION_FOCUS,
      actionId: 'action-0001',
      actionEditFocus: {
        actionId: 'action-0001',
        sequence: 10,
        editOrigin: 'runtime-focus',
        focusSource: 'runtime-detail',
        changeSummary: '三值点 12f · 敌人 HP',
      },
    });

    expect(
      controller[
        WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.EDIT_SOURCE_ACTION_EDIT_FOCUS
      ]({
        actionId: 'action-0002',
        fieldKey: 'level',
        label: '等级变更',
      })
    ).toMatchObject({
      kind: WORKBENCH_ACTION_EDIT_FLOW_PLAN_KINDS.EDIT_SOURCE_FOCUS,
      actionId: 'action-0002',
      actionEditFocus: {
        actionId: 'action-0002',
        fieldKey: 'level',
        label: '等级变更',
        sequence: 10,
      },
    });
  });
});

function createRuntimeProjectionFixture() {
  return {
    simLog: [
      {
        sourceDeltaId: 'hp-delta',
        actionId: 'action-0001',
        frameIndex: 12,
        sequenceIndex: 0,
        stateCurveSequenceIndex: 0,
        trackKey: 'enemyHpDamage',
        layerKey: 'applied',
      },
      {
        sourceDeltaId: 'energy-delta',
        actionId: 'action-0002',
        frameIndex: 30,
        sequenceIndex: 1,
        stateCurveSequenceIndex: 1,
        trackKey: 'selfEnergyChange',
        layerKey: 'applied',
      },
    ],
    stateCurves: {
      enemy: {
        points: [
          {
            sourceDeltaId: 'hp-delta',
            actionId: 'action-0001',
            frameIndex: 12,
            sequenceIndex: 0,
            stateCurveSequenceIndex: 0,
            trackKey: 'enemyHpDamage',
            layerKey: 'applied',
          },
        ],
      },
    },
    resourceCurves: {
      curvesByActor: [
        {
          actorId: 'actor-001',
          actorName: '末音',
          points: [
            {
              sourceDeltaId: 'energy-delta',
              actionId: 'action-0002',
              frameIndex: 30,
              sequenceIndex: 1,
              stateCurveSequenceIndex: 1,
              trackKey: 'selfEnergyChange',
              layerKey: 'applied',
            },
          ],
        },
      ],
    },
  };
}
