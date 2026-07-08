import { describe, expect, it } from 'vitest';
import {
  WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS,
  createWorkbenchMainFlowButtonView,
  createWorkbenchMainFlowLoopAction,
  createWorkbenchMainFlowNextAction,
  createWorkbenchMainFlowRecoveryAction,
  createWorkbenchOpenRuntimeResultsFlowAction,
  createWorkbenchRuntimeActionEditFlowAction,
  createWorkbenchRuntimeReviewOperationCommand,
  createWorkbenchRuntimeReviewOperationConsumer,
  createWorkbenchRuntimeReviewOperationFlowAction,
  createWorkbenchRuntimeReviewPanelCommandView,
  createWorkbenchRuntimeReviewPrimaryOperationFlowAction,
  createWorkbenchRuntimeReviewPrimaryOperationCommand,
  createWorkbenchRuntimeReviewPrimaryOperationView,
  createWorkbenchRuntimeResultFlowAction,
  createWorkbenchRuntimeResultReturnFlowAction,
  createWorkbenchRuntimeReviewFlowAction,
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

  it('uses runtime review primary operations for main flow focus and return actions', () => {
    const focusAction = createWorkbenchMainFlowNextAction({
      source: 'workbench-flow-panel',
      flowModel: {
        mainFlowState: {
          primaryAction: {
            kind: 'focus-runtime-action',
          },
          runtimeActionEditTarget: {
            actionId: 'fallback-action',
            statePointId: 'fallback-state-point',
          },
        },
        mainFlowLoopState: {
          nextActionKind: 'focus-runtime-action',
          canRunNextAction: true,
        },
        runtimeReviewOperations: {
          primaryOperationKind: 'focus-runtime-action',
          primaryOperationEnabled: true,
          focusAction: {
            kind: 'focus-runtime-action',
            enabled: true,
            actionId: 'review-action',
            statePointId: 'review-state-point',
            fieldKey: 'startMs',
            frameLabel: '18f',
            trackKey: 'enemyHpDamage',
            trackLabel: '敌人HP伤害',
          },
        },
      },
    });
    expect(focusAction).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'workbench-flow-panel',
      actionId: 'review-action',
      statePointId: 'review-state-point',
      canRun: true,
      payload: {
        frameLabel: '18f',
        trackKey: 'enemyHpDamage',
        trackLabel: '敌人HP伤害',
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
            actionId: 'fallback-action',
            statePointId: 'fallback-state-point',
          },
        },
        mainFlowLoopState: {
          nextActionKind: 'return-runtime-result',
          canRunNextAction: true,
        },
        runtimeReviewOperations: {
          primaryOperationKind: 'return-runtime-result',
          primaryOperationEnabled: true,
          returnResult: {
            kind: 'return-runtime-result',
            enabled: true,
            actionId: 'review-action',
            originStatePointId: 'origin-state-point',
            statePointId: 'review-state-point',
            status: 'refreshed-edit-result',
          },
        },
      },
    });
    expect(returnAction).toMatchObject({
      kind: 'return-runtime-result',
      source: 'workbench-flow-panel',
      actionId: 'review-action',
      statePointId: 'review-state-point',
      canRun: true,
      payload: {
        originStatePointId: 'origin-state-point',
        status: 'refreshed-edit-result',
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

  it('routes main flow loop actions through normal and recovery sources', () => {
    const normalAction = createWorkbenchMainFlowLoopAction({
      source: 'workbench-flow-panel',
      recoverySource: 'workbench-flow-recovery',
      flowModel: {
        runtimeSimLogCount: 2,
        controls: {
          canOpenRuntimeResults: true,
        },
        mainFlowState: {
          primaryAction: {
            kind: 'open-runtime-results',
            actionId: 'primary-action',
          },
        },
        mainFlowLoopState: {
          recoveryNeeded: false,
          nextActionKind: 'open-runtime-results',
          canRunNextAction: true,
          targetActionId: 'normal-action',
        },
      },
    });
    expect(normalAction).toMatchObject({
      kind: 'open-runtime-results',
      source: 'workbench-flow-panel',
      actionId: 'normal-action',
      canRun: true,
    });

    const recoveryAction = createWorkbenchMainFlowLoopAction({
      source: 'workbench-flow-panel',
      recoverySource: 'workbench-flow-recovery',
      flowModel: {
        runtimeSimLogCount: 2,
        controls: {
          canOpenRuntimeResults: true,
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
          targetActionId: 'recovery-action',
        },
      },
    });
    expect(recoveryAction).toMatchObject({
      kind: 'open-runtime-results',
      source: 'workbench-flow-recovery',
      actionId: 'recovery-action',
      canRun: true,
    });
  });

  it('creates main flow button views from fallback and review primary operation targets', () => {
    const focusView = createWorkbenchMainFlowButtonView({
      kind: 'focus-runtime-action',
      source: 'workbench-flow-panel',
      fallbackTarget: {
        actionId: 'fallback-action',
        statePointId: 'fallback-state-point',
        canFocusAction: true,
      },
      fallbackEnabled: true,
      flowModel: {
        mainFlowState: {
          primaryAction: {
            kind: 'focus-runtime-action',
          },
        },
        runtimeReviewOperations: {
          primaryOperationKind: 'focus-runtime-action',
          primaryOperationEnabled: true,
          primaryOperation: {
            kind: 'focus-runtime-action',
            enabled: true,
            target: {
              actionId: 'review-action',
              statePointId: 'review-state-point',
              fieldKey: 'startMs',
              frameLabel: '18f',
            },
          },
          focusAction: {
            kind: 'focus-runtime-action',
            enabled: true,
            actionId: 'model-action',
            statePointId: 'model-state-point',
          },
        },
      },
    });
    expect(focusView).toMatchObject({
      kind: 'focus-runtime-action',
      isPrimary: true,
      enabled: true,
      actionId: 'review-action',
      statePointId: 'review-state-point',
      target: {
        actionId: 'review-action',
        statePointId: 'review-state-point',
        fieldKey: 'startMs',
      },
      action: {
        kind: 'focus-runtime-action',
        source: 'workbench-flow-panel',
        actionId: 'review-action',
        statePointId: 'review-state-point',
        canRun: true,
      },
    });

    const returnView = createWorkbenchMainFlowButtonView({
      kind: 'return-runtime-result',
      fallbackTarget: {
        actionId: 'fallback-action',
        statePointId: 'fallback-state-point',
      },
      fallbackEnabled: true,
      flowModel: {
        mainFlowState: {
          primaryAction: {
            kind: 'focus-runtime-action',
          },
        },
      },
    });
    expect(returnView).toMatchObject({
      kind: 'return-runtime-result',
      isPrimary: false,
      enabled: true,
      actionId: 'fallback-action',
      statePointId: 'fallback-state-point',
      target: {
        actionId: 'fallback-action',
        statePointId: 'fallback-state-point',
      },
    });
    expect(returnView.action).toBeNull();
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

  it('creates runtime review actions through one contract entry', () => {
    const pointAction = createWorkbenchRuntimeReviewFlowAction({
      kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.SELECT_STATE_POINT,
      source: 'resource-runtime-curve',
      detail: {
        actionId: 'action-0001',
        statePointId: 'enemyHpDamage|applied|action-0001|12|0',
      },
    });
    expect(pointAction).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'resource-runtime-curve',
      actionId: 'action-0001',
      statePointId: 'enemyHpDamage|applied|action-0001|12|0',
      canRun: true,
    });

    const resultAction = createWorkbenchRuntimeReviewFlowAction({
      kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.SELECT_RESULT,
      source: 'analysis-action-result',
      actionId: 'action-0001',
      statePointId: 'enemyHpDamage|applied|action-0001|12|0',
    });
    expect(resultAction).toMatchObject({
      kind: 'select-runtime-result',
      source: 'analysis-action-result',
      actionId: 'action-0001',
      statePointId: 'enemyHpDamage|applied|action-0001|12|0',
      canRun: true,
    });

    const editAction = createWorkbenchRuntimeReviewFlowAction({
      kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
      source: 'runtime-detail',
      target: {
        actionId: 'action-0002',
        statePointId: 'selfEnergyChange|applied|action-0002|30|1',
        frameLabel: '30f',
      },
    });
    expect(editAction).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'runtime-detail',
      actionId: 'action-0002',
      statePointId: 'selfEnergyChange|applied|action-0002|30|1',
      canRun: true,
      payload: {
        frameLabel: '30f',
      },
    });

    const returnAction = createWorkbenchRuntimeReviewFlowAction({
      kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
      source: 'event-log-runtime-detail',
      context: {
        actionId: 'action-0002',
        statePointId: 'selfEnergyChange|applied|action-0002|30|1',
        originStatePointId: 'selfEnergyChange|applied|action-0002|12|0',
      },
    });
    expect(returnAction).toMatchObject({
      kind: 'return-runtime-result',
      source: 'event-log-runtime-detail',
      actionId: 'action-0002',
      statePointId: 'selfEnergyChange|applied|action-0002|30|1',
      canRun: true,
      payload: {
        originStatePointId: 'selfEnergyChange|applied|action-0002|12|0',
      },
    });
  });

  it('keeps unsupported runtime review actions disabled', () => {
    expect(
      createWorkbenchRuntimeReviewFlowAction({
        kind: 'unknown-runtime-review-action',
        source: 'runtime-detail',
        actionId: 'action-0001',
        statePointId: 'state-point-001',
      })
    ).toMatchObject({
      kind: 'unknown-runtime-review-action',
      source: 'runtime-detail',
      actionId: 'action-0001',
      statePointId: 'state-point-001',
      canRun: false,
      disabledReason: 'unsupported-runtime-review-flow-action',
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

  it('creates runtime review actions from the shared operation state', () => {
    const flowModel = {
      runtimeReviewOperations: {
        primaryOperationKind:
          WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
        primaryOperationEnabled: true,
        selectedStatePointId: 'enemyHpDamage|applied|action-0002|30|0',
        pendingStatePointId: '',
        focusAction: {
          kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
          enabled: true,
          actionId: 'action-0002',
          statePointId: 'enemyHpDamage|applied|action-0002|30|0',
          fieldKey: 'startMs',
          frameLabel: '30f',
          trackLabel: '敌人 HP',
        },
        returnResult: {
          kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
          enabled: true,
          actionId: 'action-0002',
          originStatePointId: 'enemyHpDamage|applied|action-0002|12|0',
          statePointId: 'enemyHpDamage|applied|action-0002|30|0',
          status: 'refreshed-edit-result',
        },
      },
    };

    expect(
      createWorkbenchRuntimeReviewOperationFlowAction({
        operationKind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
        source: 'runtime-detail',
        flowModel,
      })
    ).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'runtime-detail',
      actionId: 'action-0002',
      statePointId: 'enemyHpDamage|applied|action-0002|30|0',
      canRun: true,
      payload: {
        fieldKey: 'startMs',
        frameLabel: '30f',
        trackLabel: '敌人 HP',
      },
    });

    expect(
      createWorkbenchRuntimeReviewOperationFlowAction({
        operationKind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
        source: 'runtime-detail',
        flowModel,
      })
    ).toMatchObject({
      kind: 'return-runtime-result',
      source: 'runtime-detail',
      actionId: 'action-0002',
      statePointId: 'enemyHpDamage|applied|action-0002|30|0',
      canRun: true,
      payload: {
        originStatePointId: 'enemyHpDamage|applied|action-0002|12|0',
        status: 'refreshed-edit-result',
      },
    });

    expect(
      createWorkbenchRuntimeReviewPrimaryOperationFlowAction({
        source: 'runtime-detail-primary',
        flowModel,
      })
    ).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'runtime-detail-primary',
      actionId: 'action-0002',
      statePointId: 'enemyHpDamage|applied|action-0002|30|0',
      canRun: true,
    });
  });

  it('exposes a shared runtime review operation consumer', () => {
    const fallbackTarget = {
      actionId: 'fallback-action',
      statePointId: 'fallback-state-point',
      fieldKey: 'startMs',
      frameLabel: '12f',
      canFocusAction: true,
    };
    const primaryTarget = {
      kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
      enabled: true,
      actionId: 'primary-action',
      statePointId: 'primary-state-point',
      fieldKey: 'startMs',
      frameLabel: '18f',
      trackKey: 'enemyHpDamage',
      trackLabel: '敌人 HP',
    };
    const consumer = createWorkbenchRuntimeReviewOperationConsumer({
      operationKind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
      source: 'event-log-runtime-detail',
      flowModel: {
        runtimeReviewOperations: {
          primaryOperationKind:
            WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
          primaryOperationEnabled: true,
          primaryOperation: {
            kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
            enabled: true,
            target: primaryTarget,
          },
          focusAction: {
            kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
            enabled: true,
            actionId: 'model-action',
            statePointId: 'model-state-point',
          },
        },
      },
      target: fallbackTarget,
    });

    expect(consumer).toMatchObject({
      operationKind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
      source: 'event-log-runtime-detail',
      enabled: true,
      target: {
        actionId: 'primary-action',
        statePointId: 'primary-state-point',
      },
      action: {
        kind: 'focus-runtime-action',
        source: 'event-log-runtime-detail',
        actionId: 'primary-action',
        statePointId: 'primary-state-point',
        canRun: true,
      },
    });
  });

  it('lets fallback targets survive empty runtime review operations', () => {
    const fallbackContext = {
      actionId: 'fallback-action',
      originStatePointId: 'origin-state-point',
      statePointId: 'fallback-return-state-point',
      status: 'refreshed-edit-result',
    };
    const consumer = createWorkbenchRuntimeReviewOperationConsumer({
      operationKind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
      source: 'runtime-detail',
      flowModel: {
        runtimeReviewOperations: {
          primaryOperationKind:
            WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
          primaryOperationEnabled: false,
          primaryOperation: {
            kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
            enabled: false,
            target: {},
          },
          returnResult: {},
        },
      },
      context: fallbackContext,
    });

    expect(consumer).toMatchObject({
      operationKind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
      source: 'runtime-detail',
      enabled: true,
      context: {
        actionId: 'fallback-action',
        statePointId: 'fallback-return-state-point',
      },
      action: {
        kind: 'return-runtime-result',
        source: 'runtime-detail',
        actionId: 'fallback-action',
        statePointId: 'fallback-return-state-point',
        canRun: true,
      },
    });
  });

  it('creates a shared runtime review operation command for panel actions', () => {
    const command = createWorkbenchRuntimeReviewOperationCommand({
      operationKind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
      source: 'runtime-detail',
      flowModel: {
        runtimeReviewOperations: {
          primaryOperationKind:
            WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
          primaryOperationEnabled: false,
          returnResult: {},
        },
      },
      context: {
        actionId: 'fallback-action',
        originStatePointId: 'origin-state-point',
        statePointId: 'fallback-return-state-point',
        status: 'refreshed-edit-result',
      },
    });

    expect(command).toMatchObject({
      operationKind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
      source: 'runtime-detail',
      enabled: true,
      actionId: 'fallback-action',
      statePointId: 'fallback-return-state-point',
      context: {
        originStatePointId: 'origin-state-point',
        status: 'refreshed-edit-result',
      },
      view: {
        operationKind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
        enabled: true,
        actionId: 'fallback-action',
        statePointId: 'fallback-return-state-point',
      },
      action: {
        kind: 'return-runtime-result',
        source: 'runtime-detail',
        actionId: 'fallback-action',
        statePointId: 'fallback-return-state-point',
        canRun: true,
      },
    });
    expect(command.action).toBe(command.view.action);
  });

  it('creates a shared runtime review panel command view for focus and return actions', () => {
    const view = createWorkbenchRuntimeReviewPanelCommandView({
      source: 'runtime-detail',
      flowModel: {
        runtimeReviewOperations: {
          primaryOperationKind:
            WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
          primaryOperationEnabled: false,
          focusAction: {},
          returnResult: {},
        },
      },
      focusTarget: {
        actionId: 'focus-action',
        statePointId: 'focus-state-point',
        fieldKey: 'startMs',
        frameLabel: '18f',
        canFocusAction: true,
      },
      returnContext: {
        actionId: 'return-action',
        originStatePointId: 'origin-state-point',
        statePointId: 'return-state-point',
        status: 'refreshed-edit-result',
      },
    });

    expect(view).toMatchObject({
      source: 'runtime-detail',
      canFocus: true,
      canReturn: true,
      focusTarget: {
        actionId: 'focus-action',
        statePointId: 'focus-state-point',
      },
      returnContext: {
        actionId: 'return-action',
        statePointId: 'return-state-point',
      },
      focus: {
        operationKind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
        enabled: true,
        action: {
          kind: 'focus-runtime-action',
          actionId: 'focus-action',
          statePointId: 'focus-state-point',
          canRun: true,
        },
      },
      returnResult: {
        operationKind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
        enabled: true,
        action: {
          kind: 'return-runtime-result',
          actionId: 'return-action',
          statePointId: 'return-state-point',
          canRun: true,
        },
      },
      actions: {
        focus: {
          kind: 'focus-runtime-action',
          actionId: 'focus-action',
        },
        returnResult: {
          kind: 'return-runtime-result',
          actionId: 'return-action',
        },
      },
    });
    expect(view.actions.focus).toBe(view.focus.action);
    expect(view.actions.returnResult).toBe(view.returnResult.action);
  });

  it('creates the runtime review primary operation view from the consumer', () => {
    const view = createWorkbenchRuntimeReviewPrimaryOperationView({
      source: 'runtime-review-primary',
      flowModel: {
        runtimeReviewOperations: {
          primaryOperationKind:
            WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
          primaryOperationEnabled: true,
          canRunAnyOperation: true,
          primaryOperation: {
            kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
            enabled: true,
            label: '定位动作',
            target: {
              kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
              enabled: true,
              actionId: 'action-0002',
              statePointId: 'state-point-0002',
              fieldKey: 'startMs',
              frameLabel: '30f',
            },
          },
          focusAction: {
            kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
            enabled: true,
            actionId: 'fallback-action',
            statePointId: 'fallback-state-point',
          },
        },
      },
    });

    expect(view).toMatchObject({
      visible: true,
      operationKind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
      enabled: true,
      isFocusAction: true,
      actionId: 'action-0002',
      statePointId: 'state-point-0002',
      label: '定位动作',
      target: {
        actionId: 'action-0002',
        statePointId: 'state-point-0002',
      },
      action: {
        kind: 'focus-runtime-action',
        source: 'runtime-review-primary',
        actionId: 'action-0002',
        statePointId: 'state-point-0002',
        canRun: true,
      },
    });
  });

  it('creates the runtime review primary operation command from the same view action', () => {
    const command = createWorkbenchRuntimeReviewPrimaryOperationCommand({
      source: 'runtime-review-primary',
      flowModel: {
        runtimeReviewOperations: {
          primaryOperationKind:
            WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
          primaryOperationEnabled: true,
          canRunAnyOperation: true,
          primaryOperation: {
            kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
            enabled: true,
            label: '回到结果点',
            target: {
              actionId: 'action-0002',
              originStatePointId: 'origin-state-point',
              statePointId: 'state-point-0002',
              status: 'refreshed-edit-result',
            },
          },
          returnResult: {
            kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
            enabled: true,
            actionId: 'fallback-action',
            statePointId: 'fallback-state-point',
          },
        },
      },
    });

    expect(command).toMatchObject({
      source: 'runtime-review-primary',
      visible: true,
      operationKind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
      enabled: true,
      actionId: 'action-0002',
      statePointId: 'state-point-0002',
      label: '回到结果点',
      view: {
        operationKind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
        enabled: true,
        actionId: 'action-0002',
        statePointId: 'state-point-0002',
      },
      action: {
        kind: 'return-runtime-result',
        source: 'runtime-review-primary',
        actionId: 'action-0002',
        statePointId: 'state-point-0002',
        canRun: true,
      },
    });
    expect(command.action).toBe(command.view.action);
  });

  it('creates the pending result primary runtime review action', () => {
    const flowModel = {
      runtimeReviewOperations: {
        primaryOperationKind:
          WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
        primaryOperationEnabled: true,
        selectedStatePointId: '',
        pendingStatePointId: 'selfEnergyChange|applied|action-0002|30|1',
        focusAction: {
          kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.FOCUS_ACTION,
          enabled: false,
          disabledReason: 'missing-runtime-action',
        },
        returnResult: {
          kind: WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.RETURN_RESULT,
          enabled: true,
          actionId: 'action-0002',
          originStatePointId: 'selfEnergyChange|applied|action-0002|12|0',
          statePointId: 'selfEnergyChange|applied|action-0002|30|1',
          status: 'refreshed-edit-result',
        },
      },
    };

    expect(
      createWorkbenchRuntimeReviewPrimaryOperationFlowAction({
        source: 'runtime-detail-primary',
        flowModel,
      })
    ).toMatchObject({
      kind: 'return-runtime-result',
      source: 'runtime-detail-primary',
      actionId: 'action-0002',
      statePointId: 'selfEnergyChange|applied|action-0002|30|1',
      canRun: true,
      payload: {
        originStatePointId: 'selfEnergyChange|applied|action-0002|12|0',
        status: 'refreshed-edit-result',
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
