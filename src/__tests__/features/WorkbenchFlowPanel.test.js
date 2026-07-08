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
            actionId: 'review-action',
            statePointId: 'review-state-point',
            fieldKey: 'startMs',
            frameLabel: '18f',
            trackKey: 'enemyHpDamage',
            trackLabel: '敌人HP伤害',
          },
        }),
      },
    });

    const button = wrapper.find(
      '[data-testid="workbench-flow-edit-runtime-action"]'
    );
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
            actionId: 'review-action',
            originStatePointId: 'origin-state-point',
            statePointId: 'review-state-point',
            status: 'refreshed-edit-result',
          },
        }),
      },
    });

    const button = wrapper.find(
      '[data-testid="workbench-flow-return-edit-result"]'
    );
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
      sequence: 0,
      status: '',
      handled: false,
      kind: '',
      source: '',
      handlerKey: '',
      reason: '',
    },
    mainFlowLoopState: {
      step: 'runtime-review',
      status: 'ready',
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
