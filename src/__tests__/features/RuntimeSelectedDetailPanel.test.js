import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import RuntimeSelectedDetailPanel from '../../features/workbench/RuntimeSelectedDetailPanel.vue';

describe('RuntimeSelectedDetailPanel', () => {
  it('uses the runtime review primary focus operation for the action button', async () => {
    const focusOperation = {
      kind: 'focus-runtime-action',
      enabled: true,
      actionId: 'review-action',
      statePointId: 'review-state-point',
      fieldKey: 'startMs',
      frameLabel: '18f',
      trackKey: 'enemyHpDamage',
      trackLabel: '敌人HP伤害',
    };
    const wrapper = mount(RuntimeSelectedDetailPanel, {
      props: {
        detail: createRuntimeDetail(),
        flowModel: createFlowModel({
          primaryKind: 'focus-runtime-action',
          focusAction: focusOperation,
        }),
      },
    });

    const button = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-action-focus"]'
    );
    expect(button.attributes()).toMatchObject({
      'data-action-id': 'review-action',
      'data-focus-field': 'startMs',
      'data-state-point-id': 'review-state-point',
    });
    expect(button.attributes('disabled')).toBeUndefined();
    expect(button.text()).toBe('定位动作');

    await button.trigger('click');

    expect(getLastDispatchedFlowAction(wrapper)).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'runtime-detail',
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

  it('uses the runtime review primary return operation for the result button', async () => {
    const returnResult = {
      kind: 'return-runtime-result',
      enabled: true,
      actionId: 'review-action',
      originStatePointId: 'origin-state-point',
      statePointId: 'review-state-point',
      status: 'refreshed-edit-result',
    };
    const wrapper = mount(RuntimeSelectedDetailPanel, {
      props: {
        flowModel: createFlowModel({
          primaryKind: 'return-runtime-result',
          returnResult,
        }),
      },
    });

    const button = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-return-result"]'
    );
    expect(button.attributes()).toMatchObject({
      'data-action-id': 'review-action',
      'data-origin-state-point-id': 'origin-state-point',
      'data-return-status': 'refreshed-edit-result',
      'data-state-point-id': 'review-state-point',
    });
    expect(button.attributes('disabled')).toBeUndefined();
    expect(button.text()).toBe('查看刷新结果');

    await button.trigger('click');

    expect(getLastDispatchedFlowAction(wrapper)).toMatchObject({
      kind: 'return-runtime-result',
      source: 'runtime-detail',
      actionId: 'review-action',
      statePointId: 'review-state-point',
      canRun: true,
      payload: {
        originStatePointId: 'origin-state-point',
        status: 'refreshed-edit-result',
      },
    });
  });

  it('renders the selected snapshot as a three-value before and after table', () => {
    const wrapper = mount(RuntimeSelectedDetailPanel, {
      props: {
        detail: createRuntimeDetail({
          threeValueStateRows: [
            createThreeValueStateRow({
              key: 'enemyHp',
              label: '敌人 HP',
              beforeValue: 1000,
              rawDelta: 125.5,
              delta: -125.5,
              afterValue: 874.5,
              primary: true,
              changed: true,
            }),
            createThreeValueStateRow({
              key: 'enemyToughness',
              label: '敌人韧性',
              beforeValue: 80,
              rawDelta: 0,
              delta: 0,
              afterValue: 80,
            }),
            createThreeValueStateRow({
              key: 'selfEnergy',
              label: '自身能量',
              actorId: 'actor-001',
              actorName: '末音',
              beforeValue: null,
              rawDelta: 15,
              delta: 15,
              afterValue: null,
              changed: true,
            }),
          ],
        }),
      },
    });

    const table = wrapper.get(
      '[data-testid="workbench-runtime-selected-detail-three-value-state"]'
    );
    expect(table.attributes('data-state-point-id')).toBe(
      'fallback-state-point'
    );
    const rows = wrapper.findAll(
      '[data-testid="workbench-runtime-selected-detail-three-value-row"]'
    );
    expect(rows).toHaveLength(3);
    expect(rows[0].attributes()).toMatchObject({
      'data-metric-key': 'enemyHp',
      'data-primary': 'true',
      'data-raw-delta': '125.5',
      'data-state-delta': '-125.5',
    });
    expect(rows[0].text()).toContain('敌人 HP');
    expect(rows[0].text()).toContain('1,000');
    expect(rows[0].text()).toContain('-125.5');
    expect(rows[0].text()).toContain('874.5');
    expect(rows[2].text()).toContain('自身能量');
    expect(rows[2].text()).toContain('末音');
    expect(rows[2].text()).toContain('待确认');
    expect(rows[2].text()).toContain('+15');
  });
});

function createRuntimeDetail(overrides = {}) {
  return {
    actionId: 'fallback-action',
    actionName: '普通攻击',
    statePointId: 'fallback-state-point',
    frameLabel: '12f',
    timeMs: 200,
    trackKey: 'enemyHpDamage',
    trackLabel: '敌人HP伤害',
    status: 'applied',
    delta: 100,
    cumulative: 100,
    contributionRows: [],
    calculatorRows: [],
    sourceRows: [],
    threeValueStateRows: [],
    ...overrides,
  };
}

function createThreeValueStateRow(overrides = {}) {
  return {
    key: 'enemyHp',
    label: '敌人 HP',
    actorId: '',
    actorName: '',
    beforeValue: 0,
    rawDelta: 0,
    delta: 0,
    afterValue: 0,
    primary: false,
    changed: false,
    baselineStatus: 'test-baseline',
    ...overrides,
  };
}

function createFlowModel({ primaryKind, focusAction = {}, returnResult = {} }) {
  const fallbackActionTarget = {
    actionId: 'fallback-action',
    statePointId: 'fallback-state-point',
    fieldKey: 'startMs',
    frameLabel: '12f',
    trackKey: 'enemyHpDamage',
    trackLabel: '敌人HP伤害',
    canFocusAction: true,
  };
  const fallbackReturnTarget = {
    actionId: 'fallback-action',
    originStatePointId: 'fallback-origin-state-point',
    statePointId: 'fallback-return-state-point',
    status: 'origin-result',
  };
  const target =
    primaryKind === 'focus-runtime-action' ? focusAction : returnResult;
  return {
    phase: 'runtime-result',
    editResult: null,
    mainFlowState: {
      runtimeActionEditTarget: fallbackActionTarget,
      resultReturnTarget: fallbackReturnTarget,
    },
    runtimeReviewSelection: {
      status: primaryKind === 'return-runtime-result' ? 'pending' : 'selected',
      hasSelection: primaryKind === 'focus-runtime-action',
      hasPendingResult: primaryKind === 'return-runtime-result',
      selectedActionId: focusAction.actionId ?? '',
      selectedStatePointId: focusAction.statePointId ?? '',
      pendingActionId: returnResult.actionId ?? '',
      pendingStatePointId: returnResult.statePointId ?? '',
      source: 'runtime-detail-test',
      sourceKind: 'sim-log',
    },
    runtimeReviewOperations: {
      primaryOperationKind: primaryKind,
      primaryOperationEnabled: true,
      canRunAnyOperation: true,
      selectionStatus:
        primaryKind === 'return-runtime-result' ? 'pending' : 'selected',
      selectedStatePointId: focusAction.statePointId ?? '',
      pendingStatePointId: returnResult.statePointId ?? '',
      primaryOperation: {
        kind: primaryKind,
        enabled: true,
        label:
          primaryKind === 'return-runtime-result' ? '回到结果点' : '定位动作',
        actionId: target.actionId ?? '',
        statePointId: target.statePointId ?? '',
        target,
      },
      focusAction,
      returnResult,
    },
  };
}

function getLastDispatchedFlowAction(wrapper) {
  const events = wrapper.emitted('dispatch-flow-action') ?? [];
  return events.at(-1)?.[0] ?? null;
}
