import { describe, expect, it } from 'vitest';
import {
  WORKBENCH_FLOW_ACTION_KINDS,
  createWorkbenchFlowAction,
} from '../../features/workbench/workbenchFlowModel';
import {
  WORKBENCH_FLOW_CONTROLLER_HANDLERS,
  createWorkbenchFlowController,
} from '../../features/workbench/workbenchFlowController';

describe('workbench flow controller', () => {
  it('routes runtime and edit flow actions to explicit workbench handlers', () => {
    const calls = [];
    const controller = createWorkbenchFlowController({
      openRuntimeResults: payload =>
        calls.push(['openRuntimeResults', payload]),
      selectRuntimeResult: payload =>
        calls.push(['selectRuntimeResult', payload]),
      selectRuntimeStatePoint: payload =>
        calls.push(['selectRuntimeStatePoint', payload]),
      selectContributionPoint: payload =>
        calls.push(['selectContributionPoint', payload]),
      focusRuntimeAction: payload => calls.push(['focusRuntimeAction', payload]),
      focusEditSource: payload => calls.push(['focusEditSource', payload]),
      returnRuntimeResult: payload =>
        calls.push(['returnRuntimeResult', payload]),
    });

    expect(
      controller.dispatch({
        kind: WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
        source: 'workbench-flow-panel',
        actionId: 'action-0000',
      })
    ).toMatchObject({
      handled: true,
      handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.OPEN_RUNTIME_RESULTS,
    });
    expect(
      controller.dispatch({
        kind: WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_RESULT,
        source: 'analysis-action-result',
        actionId: 'action-0001',
        statePointId: 'runtime-point-001',
      })
    ).toMatchObject({
      handled: true,
      handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.SELECT_RUNTIME_RESULT,
    });
    expect(
      controller.dispatch({
        kind: WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_STATE_POINT,
        source: 'resource-runtime-curve',
        statePointId: 'runtime-point-002',
      })
    ).toMatchObject({
      handled: true,
      handlerKey:
        WORKBENCH_FLOW_CONTROLLER_HANDLERS.SELECT_RUNTIME_STATE_POINT,
    });
    expect(
      controller.dispatch({
        kind: WORKBENCH_FLOW_ACTION_KINDS.SELECT_CONTRIBUTION_POINT,
        source: 'analysis-action-contribution',
        statePointId: 'runtime-point-003',
      })
    ).toMatchObject({
      handled: true,
      handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.SELECT_CONTRIBUTION_POINT,
    });

    const runtimeFocusPayload = {
      actionId: 'action-0002',
      fieldKey: 'startMs',
      statePointId: 'runtime-point-004',
    };
    expect(
      controller.dispatch({
        kind: WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION,
        source: 'runtime-detail',
        actionId: runtimeFocusPayload.actionId,
        statePointId: runtimeFocusPayload.statePointId,
        payload: runtimeFocusPayload,
      })
    ).toMatchObject({
      handled: true,
      handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.FOCUS_RUNTIME_ACTION,
    });

    const editSourcePayload = {
      actionId: 'action-0003',
      fieldKey: 'level',
      label: '等级变更',
    };
    expect(
      controller.dispatch({
        kind: WORKBENCH_FLOW_ACTION_KINDS.FOCUS_EDIT_SOURCE,
        source: 'analysis-edit-source',
        actionId: editSourcePayload.actionId,
        fieldKey: editSourcePayload.fieldKey,
        payload: editSourcePayload,
      })
    ).toMatchObject({
      handled: true,
      handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.FOCUS_EDIT_SOURCE,
    });
    expect(
      controller.dispatch({
        kind: WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT,
        source: 'properties-panel',
        actionId: 'action-0004',
        statePointId: 'runtime-point-005',
      })
    ).toMatchObject({
      handled: true,
      handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.RETURN_RUNTIME_RESULT,
    });

    expect(calls).toEqual([
      ['openRuntimeResults', { actionId: 'action-0000' }],
      [
        'selectRuntimeResult',
        { actionId: 'action-0001', statePointId: 'runtime-point-001' },
      ],
      ['selectRuntimeStatePoint', 'runtime-point-002'],
      ['selectContributionPoint', 'runtime-point-003'],
      ['focusRuntimeAction', runtimeFocusPayload],
      ['focusEditSource', editSourcePayload],
      [
        'returnRuntimeResult',
        { actionId: 'action-0004', statePointId: 'runtime-point-005' },
      ],
    ]);
  });

  it('does not call handlers for disabled, unsupported, or unhandled actions', () => {
    const calls = [];
    const controller = createWorkbenchFlowController({
      selectRuntimeStatePoint: payload =>
        calls.push(['selectRuntimeStatePoint', payload]),
    });

    const disabledResult = controller.dispatch(
      createWorkbenchFlowAction({
        kind: WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_STATE_POINT,
        source: 'resource-runtime-curve',
        enabled: false,
        disabledReason: 'missing-runtime-state-point',
      })
    );
    expect(disabledResult).toMatchObject({
      handled: false,
      reason: 'missing-runtime-state-point',
    });

    const unsupportedResult = controller.dispatch({
      kind: 'unknown-action-kind',
      source: 'test',
      statePointId: 'runtime-point-unknown',
    });
    expect(unsupportedResult).toMatchObject({
      handled: false,
      reason: 'unsupported-flow-action-kind',
    });

    const missingHandlerResult = controller.dispatch({
      kind: WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT,
      source: 'properties-panel',
      actionId: 'action-0001',
      statePointId: 'runtime-point-001',
    });
    expect(missingHandlerResult).toMatchObject({
      handled: false,
      handlerKey: WORKBENCH_FLOW_CONTROLLER_HANDLERS.RETURN_RUNTIME_RESULT,
      reason: 'missing-flow-handler',
    });

    expect(calls).toEqual([]);
  });
});
