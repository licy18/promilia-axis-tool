import { describe, expect, it } from 'vitest';
import {
  createWorkbenchOpenRuntimeResultsFlowAction,
  createWorkbenchRuntimeActionEditFlowAction,
  createWorkbenchRuntimeResultFlowAction,
  createWorkbenchRuntimeResultReturnFlowAction,
  createWorkbenchRuntimeStatePointFlowAction,
} from '../../features/workbench/workbenchMainFlowActions';

describe('workbench main flow actions', () => {
  it('creates an open-runtime-results action from the shared flow model state', () => {
    const action = createWorkbenchOpenRuntimeResultsFlowAction({
      source: 'workbench-flow-panel',
      flowModel: {
        selectedActionId: 'fallback-action',
        runtimeSimLogCount: 2,
        controls: {
          canOpenRuntimeResults: true,
        },
        mainFlowState: {
          primaryAction: {
            actionId: 'action-0001',
          },
        },
      },
    });

    expect(action).toMatchObject({
      kind: 'open-runtime-results',
      source: 'workbench-flow-panel',
      actionId: 'action-0001',
      canRun: true,
      payload: {
        runtimeSimLogCount: 2,
        fallbackToFirstRuntimePoint: true,
      },
    });
  });

  it('creates runtime point and result focus actions with the same main flow factory', () => {
    const statePointAction = createWorkbenchRuntimeStatePointFlowAction({
      source: 'resource-runtime-curve',
      detail: {
        actionId: 'action-0001',
        statePointId: 'enemyHpDamage|applied|action-0001|12|0',
      },
    });
    const resultAction = createWorkbenchRuntimeResultFlowAction({
      source: 'analysis-action-result',
      actionId: 'action-0001',
      statePointId: 'enemyHpDamage|applied|action-0001|12|0',
    });

    expect(statePointAction).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'resource-runtime-curve',
      actionId: 'action-0001',
      statePointId: 'enemyHpDamage|applied|action-0001|12|0',
      canRun: true,
    });
    expect(resultAction).toMatchObject({
      kind: 'select-runtime-result',
      source: 'analysis-action-result',
      actionId: 'action-0001',
      statePointId: 'enemyHpDamage|applied|action-0001|12|0',
      canRun: true,
    });
  });

  it('creates runtime action edit and result return actions from shared targets', () => {
    const editAction = createWorkbenchRuntimeActionEditFlowAction({
      source: 'runtime-detail',
      target: {
        actionId: 'action-0002',
        statePointId: 'selfEnergyChange|applied|action-0002|30|1',
        frameLabel: '30f',
        canFocusAction: true,
      },
    });
    const returnAction = createWorkbenchRuntimeResultReturnFlowAction({
      source: 'runtime-detail',
      target: {
        actionId: 'action-0002',
        originStatePointId: 'selfEnergyChange|applied|action-0002|12|0',
        statePointId: 'selfEnergyChange|applied|action-0002|30|1',
      },
    });

    expect(editAction).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'runtime-detail',
      actionId: 'action-0002',
      statePointId: 'selfEnergyChange|applied|action-0002|30|1',
      canRun: true,
      payload: {
        actionId: 'action-0002',
        frameLabel: '30f',
      },
    });
    expect(returnAction).toMatchObject({
      kind: 'return-runtime-result',
      source: 'runtime-detail',
      actionId: 'action-0002',
      statePointId: 'selfEnergyChange|applied|action-0002|30|1',
      canRun: true,
      payload: {
        originStatePointId: 'selfEnergyChange|applied|action-0002|12|0',
      },
    });
  });

  it('keeps disabled main flow actions explicit when targets are missing', () => {
    expect(
      createWorkbenchOpenRuntimeResultsFlowAction({
        flowModel: {
          selectedActionId: 'action-0001',
          controls: {
            canOpenRuntimeResults: false,
          },
        },
      })
    ).toMatchObject({
      kind: 'open-runtime-results',
      canRun: false,
      disabledReason: 'missing-runtime-results',
    });
    expect(createWorkbenchRuntimeResultReturnFlowAction()).toMatchObject({
      kind: 'return-runtime-result',
      canRun: false,
      disabledReason: 'missing-runtime-result',
    });
  });
});
