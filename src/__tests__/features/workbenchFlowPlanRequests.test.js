import { describe, expect, it } from 'vitest';
import { WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS } from '../../features/workbench/workbenchFlowPlanController';
import {
  WORKBENCH_FLOW_PLAN_APPLICATION_KINDS,
  applyWorkbenchFlowPlanRequest,
  createWorkbenchContributionPointFocusPlanRequest,
  createWorkbenchEditSourceActionEditPlanRequest,
  createWorkbenchFlowPlanFromRequest,
  createWorkbenchRuntimeActionEditPlanRequest,
  createWorkbenchRuntimeEntryPlanRequest,
  createWorkbenchRuntimePointFocusPlanRequest,
  createWorkbenchRuntimeResultReturnPlanRequest,
} from '../../features/workbench/workbenchFlowPlanRequests';

describe('workbench flow plan requests', () => {
  it('creates shared runtime plan requests', () => {
    expect(
      createWorkbenchRuntimeEntryPlanRequest({
        actionId: 'action-open',
        fallbackToFirstRuntimePoint: true,
      })
    ).toEqual({
      applicationKind: WORKBENCH_FLOW_PLAN_APPLICATION_KINDS.RUNTIME,
      methodKey: WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_ENTRY,
      payload: {
        actionId: 'action-open',
        fallbackToFirstRuntimePoint: true,
      },
    });

    expect(
      createWorkbenchRuntimeResultReturnPlanRequest({
        actionId: 'action-result',
        statePointId: 'point-result',
      })
    ).toEqual({
      applicationKind: WORKBENCH_FLOW_PLAN_APPLICATION_KINDS.RUNTIME,
      methodKey: WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_RESULT_RETURN,
      payload: {
        actionId: 'action-result',
        statePointId: 'point-result',
        source: 'action-result',
      },
    });

    expect(
      createWorkbenchRuntimePointFocusPlanRequest({
        statePointId: 'point-direct',
        preserveStateCurveFilters: true,
      })
    ).toEqual({
      applicationKind: WORKBENCH_FLOW_PLAN_APPLICATION_KINDS.RUNTIME,
      methodKey: WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_POINT_FOCUS,
      payload: {
        statePointId: 'point-direct',
        source: 'runtime-state-point',
        preserveStateCurveFilters: true,
      },
    });

    expect(
      createWorkbenchContributionPointFocusPlanRequest({
        statePointId: 'point-contribution',
      })
    ).toEqual({
      applicationKind: WORKBENCH_FLOW_PLAN_APPLICATION_KINDS.RUNTIME,
      methodKey: WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_POINT_FOCUS,
      payload: {
        statePointId: 'point-contribution',
        source: 'action-contribution',
        preserveStateCurveFilters: false,
      },
    });
  });

  it('creates shared action edit plan requests', () => {
    expect(
      createWorkbenchRuntimeActionEditPlanRequest({
        actionId: 'action-focus',
        fieldKey: 'startMs',
      })
    ).toEqual({
      applicationKind: WORKBENCH_FLOW_PLAN_APPLICATION_KINDS.ACTION_EDIT,
      methodKey:
        WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_ACTION_EDIT_FOCUS,
      payload: {
        actionId: 'action-focus',
        fieldKey: 'startMs',
      },
    });

    expect(
      createWorkbenchEditSourceActionEditPlanRequest({
        actionId: 'action-edit-source',
        fieldKey: 'level',
      })
    ).toEqual({
      applicationKind: WORKBENCH_FLOW_PLAN_APPLICATION_KINDS.ACTION_EDIT,
      methodKey:
        WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.EDIT_SOURCE_ACTION_EDIT_FOCUS,
      payload: {
        actionId: 'action-edit-source',
        fieldKey: 'level',
      },
    });
  });

  it('creates and applies plans from requests', () => {
    const runtimePlans = [];
    const actionEditPlans = [];
    const flowPlanController = {
      [WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_RESULT_RETURN]:
        payload => ({
          plan: 'runtime-result-return',
          payload,
        }),
      [WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_ACTION_EDIT_FOCUS]:
        payload => ({
          plan: 'runtime-action-edit-focus',
          payload,
        }),
    };

    const runtimeRequest = createWorkbenchRuntimeResultReturnPlanRequest({
      actionId: 'action-return',
      statePointId: 'point-return',
      source: 'workbench-flow-panel',
    });
    const actionEditRequest = createWorkbenchRuntimeActionEditPlanRequest({
      actionId: 'action-focus',
      fieldKey: 'startMs',
    });

    expect(
      createWorkbenchFlowPlanFromRequest({
        flowPlanController,
        request: runtimeRequest,
      })
    ).toEqual({
      plan: 'runtime-result-return',
      payload: {
        actionId: 'action-return',
        statePointId: 'point-return',
        source: 'workbench-flow-panel',
      },
    });

    applyWorkbenchFlowPlanRequest({
      flowPlanController,
      request: runtimeRequest,
      applyRuntimeFlowPlan: plan => runtimePlans.push(plan),
      applyActionEditFlowPlan: plan => actionEditPlans.push(plan),
    });
    applyWorkbenchFlowPlanRequest({
      flowPlanController,
      request: actionEditRequest,
      applyRuntimeFlowPlan: plan => runtimePlans.push(plan),
      applyActionEditFlowPlan: plan => actionEditPlans.push(plan),
    });

    expect(runtimePlans).toEqual([
      {
        plan: 'runtime-result-return',
        payload: {
          actionId: 'action-return',
          statePointId: 'point-return',
          source: 'workbench-flow-panel',
        },
      },
    ]);
    expect(actionEditPlans).toEqual([
      {
        plan: 'runtime-action-edit-focus',
        payload: {
          actionId: 'action-focus',
          fieldKey: 'startMs',
        },
      },
    ]);
  });
});
