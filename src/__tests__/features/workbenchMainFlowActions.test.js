import { describe, expect, it } from 'vitest';
import {
  createWorkbenchMainFlowNextAction,
  createWorkbenchMainFlowRecoveryAction,
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

  it('creates the primary main flow action from the loop state contract', () => {
    const openAction = createWorkbenchMainFlowNextAction({
      source: 'workbench-flow-panel',
      flowModel: {
        runtimeSimLogCount: 3,
        controls: {
          canOpenRuntimeResults: false,
        },
        mainFlowState: {
          primaryAction: {
            kind: 'open-runtime-results',
            actionId: 'primary-action',
          },
        },
        mainFlowLoopState: {
          nextActionKind: 'open-runtime-results',
          canRunNextAction: true,
          targetActionId: 'loop-action',
        },
      },
    });
    expect(openAction).toMatchObject({
      kind: 'open-runtime-results',
      source: 'workbench-flow-panel',
      actionId: 'loop-action',
      canRun: true,
      payload: {
        runtimeSimLogCount: 3,
        fallbackToFirstRuntimePoint: true,
      },
    });

    const editAction = createWorkbenchMainFlowNextAction({
      source: 'workbench-flow-panel',
      flowModel: {
        mainFlowState: {
          primaryAction: {
            kind: 'focus-runtime-action',
          },
          runtimeActionEditTarget: {
            frameLabel: '30f',
            trackKey: 'selfEnergyChange',
          },
        },
        mainFlowLoopState: {
          nextActionKind: 'focus-runtime-action',
          canRunNextAction: true,
          targetActionId: 'loop-action',
          targetStatePointId: 'loop-state-point',
        },
      },
    });
    expect(editAction).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'workbench-flow-panel',
      actionId: 'loop-action',
      statePointId: 'loop-state-point',
      canRun: true,
      payload: {
        frameLabel: '30f',
        trackKey: 'selfEnergyChange',
      },
    });

    const returnAction = createWorkbenchMainFlowNextAction({
      source: 'workbench-flow-panel',
      flowModel: {
        mainFlowState: {
          primaryAction: {
            kind: 'return-runtime-result',
          },
          resultReturnTarget: {
            originStatePointId: 'origin-state-point',
          },
        },
        mainFlowLoopState: {
          nextActionKind: 'return-runtime-result',
          canRunNextAction: true,
          targetActionId: 'loop-action',
          targetStatePointId: 'refreshed-state-point',
        },
      },
    });
    expect(returnAction).toMatchObject({
      kind: 'return-runtime-result',
      source: 'workbench-flow-panel',
      actionId: 'loop-action',
      statePointId: 'refreshed-state-point',
      canRun: true,
      payload: {
        originStatePointId: 'origin-state-point',
      },
    });
  });

  it('keeps a disabled action when the main flow loop has no next action', () => {
    expect(
      createWorkbenchMainFlowNextAction({
        source: 'workbench-flow-panel',
        flowModel: {
          mainFlowLoopState: {
            nextActionKind: '',
            canRunNextAction: false,
          },
        },
      })
    ).toMatchObject({
      source: 'workbench-flow-panel',
      canRun: false,
      disabledReason: 'missing-main-flow-next-action',
    });
  });

  it('creates a recovery action from the blocked main flow loop state', () => {
    const recoveryAction = createWorkbenchMainFlowRecoveryAction({
      source: 'workbench-flow-recovery',
      flowModel: {
        runtimeSimLogCount: 2,
        controls: {
          canOpenRuntimeResults: false,
        },
        mainFlowState: {
          primaryAction: {
            kind: 'open-runtime-results',
            actionId: 'primary-action',
          },
        },
        mainFlowLoopState: {
          recoveryNeeded: true,
          nextActionKind: 'open-runtime-results',
          canRunNextAction: true,
          targetActionId: 'loop-action',
        },
      },
    });

    expect(recoveryAction).toMatchObject({
      kind: 'open-runtime-results',
      source: 'workbench-flow-recovery',
      actionId: 'loop-action',
      canRun: true,
      payload: {
        runtimeSimLogCount: 2,
        fallbackToFirstRuntimePoint: true,
      },
    });
  });

  it('keeps recovery disabled when the main flow loop is not blocked', () => {
    expect(
      createWorkbenchMainFlowRecoveryAction({
        source: 'workbench-flow-recovery',
        flowModel: {
          mainFlowState: {
            primaryAction: {
              kind: 'open-runtime-results',
            },
          },
          mainFlowLoopState: {
            recoveryNeeded: false,
            nextActionKind: 'open-runtime-results',
            canRunNextAction: true,
            targetActionId: 'loop-action',
          },
        },
      })
    ).toMatchObject({
      kind: 'open-runtime-results',
      source: 'workbench-flow-recovery',
      actionId: 'loop-action',
      canRun: false,
      disabledReason: 'main-flow-recovery-not-needed',
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
