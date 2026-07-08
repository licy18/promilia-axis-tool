import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import WorkbenchFlowPanel from '../../features/workbench/WorkbenchFlowPanel.vue';

describe('WorkbenchFlowPanel', () => {
  it('shows and dispatches the runtime review primary focus operation', async () => {
    const wrapper = mount(WorkbenchFlowPanel, {
      props: {
        flowModel: createFlowModel({
          primaryKind: 'focus-runtime-action',
          primaryOperation: {
            kind: 'focus-runtime-action',
            enabled: true,
            target: {
              actionId: 'review-action',
              statePointId: 'review-state-point',
              fieldKey: 'startMs',
              frameLabel: '18f',
              trackKey: 'enemyHpDamage',
              trackLabel: '敌人HP伤害',
            },
          },
        }),
      },
    });

    const button = wrapper.find(
      '[data-testid="workbench-flow-edit-runtime-action"]'
    );
    expect(wrapper.attributes()).toMatchObject({
      'data-main-flow-dispatch-sequence': '2',
      'data-main-flow-dispatch-status': 'handled',
      'data-main-flow-dispatch-handled': 'true',
      'data-main-flow-dispatch-kind': 'focus-runtime-action',
      'data-main-flow-dispatch-source': 'runtime-review-primary',
      'data-main-flow-dispatch-handler-key': 'focusRuntimeAction',
      'data-main-flow-dispatch-reason': '',
      'data-main-flow-loop-step': 'runtime-review',
      'data-main-flow-loop-status': 'advanced',
      'data-main-flow-loop-recovery-needed': 'false',
      'data-main-flow-loop-next-action-kind': 'focus-runtime-action',
      'data-main-flow-loop-next-target-kind': 'runtime-action-edit',
    });
    expect(button.attributes()).toMatchObject({
      'data-action-id': 'review-action',
      'data-primary-action': 'true',
      'data-state-point-id': 'review-state-point',
    });
    expect(button.attributes('disabled')).toBeUndefined();

    await button.trigger('click');

    expect(getLastDispatchedFlowAction(wrapper)).toMatchObject({
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
  });

  it('shows and dispatches the runtime review primary return operation', async () => {
    const wrapper = mount(WorkbenchFlowPanel, {
      props: {
        flowModel: createFlowModel({
          primaryKind: 'return-runtime-result',
          primaryOperation: {
            kind: 'return-runtime-result',
            enabled: true,
            target: {
              actionId: 'review-action',
              originStatePointId: 'origin-state-point',
              statePointId: 'review-state-point',
              status: 'refreshed-edit-result',
            },
          },
        }),
      },
    });

    const button = wrapper.find(
      '[data-testid="workbench-flow-return-edit-result"]'
    );
    expect(wrapper.attributes()).toMatchObject({
      'data-main-flow-dispatch-sequence': '2',
      'data-main-flow-dispatch-status': 'handled',
      'data-main-flow-dispatch-handled': 'true',
      'data-main-flow-dispatch-kind': 'return-runtime-result',
      'data-main-flow-dispatch-source': 'runtime-review-primary',
      'data-main-flow-loop-next-action-kind': 'return-runtime-result',
      'data-main-flow-loop-next-target-kind': 'runtime-result-return',
    });
    expect(button.attributes()).toMatchObject({
      'data-action-id': 'review-action',
      'data-primary-action': 'true',
      'data-state-point-id': 'review-state-point',
    });
    expect(button.attributes('disabled')).toBeUndefined();

    await button.trigger('click');

    expect(getLastDispatchedFlowAction(wrapper)).toMatchObject({
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

  it('uses an injected main flow command surface for button views and actions', async () => {
    const wrapper = mount(WorkbenchFlowPanel, {
      props: {
        flowModel: createFlowModel({
          primaryKind: 'focus-runtime-action',
          primaryOperation: {
            kind: 'focus-runtime-action',
            enabled: true,
            target: {
              actionId: 'review-action',
              statePointId: 'review-state-point',
            },
          },
        }),
        mainFlowCommandSurface: createInjectedMainFlowCommandSurface(),
      },
    });

    const button = wrapper.find(
      '[data-testid="workbench-flow-edit-runtime-action"]'
    );
    expect(button.attributes()).toMatchObject({
      'data-action-id': 'surface-action',
      'data-primary-action': 'false',
      'data-state-point-id': 'surface-state-point',
    });

    await button.trigger('click');

    expect(getLastDispatchedFlowAction(wrapper)).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'shared-surface-test',
      actionId: 'surface-action',
      statePointId: 'surface-state-point',
      canRun: true,
    });
  });
});

function createFlowModel({ primaryKind, primaryOperation }) {
  return {
    selectedActionId: 'selected-action',
    selectedActionName: '普通攻击',
    phase: 'runtime-result',
    runtimeOverviewActive: false,
    runtimeSimLogCount: 1,
    contractContext: {
      contractName: 'Action -> Hit -> ThreeValueDelta',
      generationEntry: {
        status: 'ready',
      },
      runtimeInput: {
        appliedDeltaSource: 'threeValueRuntimeInput.appliedDeltas',
      },
      runtimeOutput: {
        status: 'ready',
      },
    },
    runtimeDetail: {
      actionId: 'detail-action',
      statePointId: 'detail-state-point',
      label: '18f · 敌人HP伤害',
    },
    editResult: {
      statePointId: '',
      label: '无刷新结果',
    },
    runtimeNavigation: {
      count: 1,
      index: 0,
      label: '1/1',
      previous: null,
      next: null,
    },
    mainFlowState: {
      primaryAction: {
        kind: primaryKind,
        actionId: 'fallback-action',
        statePointId: 'fallback-state-point',
      },
      runtimeActionEditTarget: {
        actionId: 'fallback-action',
        statePointId: 'fallback-state-point',
        canFocusAction: true,
      },
      resultReturnTarget: {
        actionId: 'fallback-action',
        statePointId: 'fallback-state-point',
      },
      actionEditStatePointId: '',
      returnStatePointId: '',
      nextTargetKind:
        primaryKind === 'return-runtime-result'
          ? 'runtime-result-return'
          : 'runtime-action-edit',
      canFocusRuntimeAction: true,
      canReturnRuntimeResult: true,
    },
    mainFlowDispatchResult: {
      sequence: 2,
      status: 'handled',
      handled: true,
      hasResult: true,
      kind: primaryKind,
      source: 'runtime-review-primary',
      handlerKey:
        primaryKind === 'return-runtime-result'
          ? 'returnRuntimeResult'
          : 'focusRuntimeAction',
      reason: '',
    },
    mainFlowLoopState: {
      step: 'runtime-review',
      status: 'advanced',
      recoveryNeeded: false,
      nextActionKind: primaryKind,
      nextTargetKind:
        primaryKind === 'return-runtime-result'
          ? 'runtime-result-return'
          : 'runtime-action-edit',
      canRunNextAction: true,
    },
    runtimeReviewOperations: {
      primaryOperationKind: primaryKind,
      primaryOperationEnabled: true,
      primaryOperation,
      focusAction:
        primaryKind === 'focus-runtime-action' ? primaryOperation : {},
      returnResult:
        primaryKind === 'return-runtime-result' ? primaryOperation : {},
    },
    controls: {
      canOpenRuntimeResults: true,
    },
  };
}

function getLastDispatchedFlowAction(wrapper) {
  const events = wrapper.emitted('dispatch-flow-action') ?? [];
  return events.at(-1)?.[0] ?? null;
}

function createInjectedMainFlowCommandSurface() {
  const runtimeActionEditAction = {
    kind: 'focus-runtime-action',
    source: 'shared-surface-test',
    actionId: 'surface-action',
    statePointId: 'surface-state-point',
    canRun: true,
  };
  const openRuntimeResultsAction = {
    kind: 'open-runtime-results',
    source: 'shared-surface-test',
    actionId: 'surface-action',
    canRun: true,
  };
  const runtimeResultReturnAction = {
    kind: 'return-runtime-result',
    source: 'shared-surface-test',
    actionId: 'surface-action',
    statePointId: 'surface-return-state-point',
    canRun: true,
  };

  return {
    openRuntimeResults: {
      kind: 'open-runtime-results',
      isPrimary: false,
      enabled: true,
      target: {},
      action: openRuntimeResultsAction,
    },
    runtimeActionEdit: {
      kind: 'focus-runtime-action',
      isPrimary: false,
      enabled: true,
      actionId: 'surface-action',
      statePointId: 'surface-state-point',
      target: {
        actionId: 'surface-action',
        statePointId: 'surface-state-point',
      },
      action: runtimeActionEditAction,
    },
    runtimeResultReturn: {
      kind: 'return-runtime-result',
      isPrimary: false,
      enabled: true,
      actionId: 'surface-action',
      statePointId: 'surface-return-state-point',
      target: {
        actionId: 'surface-action',
        statePointId: 'surface-return-state-point',
      },
      action: runtimeResultReturnAction,
    },
    actions: {
      openRuntimeResults: openRuntimeResultsAction,
      runtimeActionEdit: runtimeActionEditAction,
      runtimeResultReturn: runtimeResultReturnAction,
    },
  };
}
