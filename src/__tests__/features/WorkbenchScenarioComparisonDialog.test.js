import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import WorkbenchScenarioComparisonDialog from '../../features/workbench/WorkbenchScenarioComparisonDialog.vue';

describe('WorkbenchScenarioComparisonDialog', () => {
  it('selects any inactive workspace scenario as the comparison baseline', async () => {
    const wrapper = mount(WorkbenchScenarioComparisonDialog, {
      attachTo: document.body,
      props: {
        visible: true,
        activeWorkspaceScenarioId: 'scenario-0001',
        workspaceScenarios: [
          scenario('scenario-0001', '当前方案', 'action-current'),
          scenario('scenario-0002', '对照方案', 'action-baseline'),
        ],
      },
      global: { stubs: { teleport: true } },
    });

    const select = wrapper.get(
      '[data-testid="workbench-comparison-workspace-scenario"]'
    );
    expect(select.findAll('option')).toHaveLength(2);
    await select.setValue('scenario-0002');
    expect(wrapper.emitted('select-workspace-scenario')?.[0]).toEqual([
      'scenario-0002',
    ]);

    wrapper.unmount();
  });

  it('reflects an existing workspace baseline when reopened', () => {
    const wrapper = mount(WorkbenchScenarioComparisonDialog, {
      attachTo: document.body,
      props: {
        visible: true,
        activeWorkspaceScenarioId: 'scenario-0001',
        workspaceScenarios: [
          scenario('scenario-0001', '当前方案', 'action-current'),
          scenario('scenario-0002', '对照方案', 'action-baseline'),
        ],
        baselineSource: {
          kind: 'workspace-scenario',
          id: 'scenario-0002',
          label: '对照方案',
        },
      },
      global: { stubs: { teleport: true } },
    });

    expect(
      wrapper.get('[data-testid="workbench-comparison-workspace-scenario"]')
        .element.value
    ).toBe('scenario-0002');
    wrapper.unmount();
  });

  it('selects a shared window and locates both comparison sources', async () => {
    const wrapper = mount(WorkbenchScenarioComparisonDialog, {
      attachTo: document.body,
      props: {
        visible: true,
        baselineSource: {
          kind: 'workspace-scenario',
          id: 'scenario-0002',
          label: '对照方案',
        },
        comparison: readyComparison(),
      },
      global: { stubs: { teleport: true } },
    });

    await wrapper
      .get(
        '[data-testid="workbench-comparison-window"][data-window-id="cycle-section-02"]'
      )
      .trigger('click');
    expect(wrapper.emitted('select-window')?.at(-1)?.[0]).toBe(
      'cycle-section-02'
    );

    await wrapper
      .get('[data-testid="workbench-comparison-locate-action"]')
      .trigger('click');
    expect(wrapper.emitted('locate-action')?.at(-1)?.[0]).toEqual({
      role: 'current',
      actionId: 'action-1',
      statePointId: 'current-point',
      frameIndex: 18,
    });
    await wrapper
      .get('[data-testid="workbench-comparison-locate-baseline-action"]')
      .trigger('click');
    expect(wrapper.emitted('locate-action')?.at(-1)?.[0]).toEqual({
      role: 'baseline',
      actionId: 'action-1',
      statePointId: 'baseline-point',
      frameIndex: 12,
    });
    await wrapper
      .get('[data-testid="workbench-export-comparison-report"]')
      .trigger('click');
    expect(wrapper.emitted('export-report')).toHaveLength(1);

    wrapper.unmount();
  });
});

function readyComparison() {
  const metric = (current, baseline) => ({
    current,
    baseline,
    delta: current - baseline,
    changed: current !== baseline,
  });
  return {
    status: 'scenario-comparison-ready',
    windowId: 'full-axis',
    windows: [
      {
        windowId: 'full-axis',
        kind: 'axis',
        label: '全轴',
        comparable: true,
        currentRange: { startMs: 0, endMs: 3000 },
        baselineRange: { startMs: 0, endMs: 3000 },
      },
      {
        windowId: 'cycle-section-02',
        kind: 'section',
        label: '循环 2',
        comparable: true,
        currentRange: { startMs: 1000, endMs: 3000 },
        baselineRange: { startMs: 1000, endMs: 3000 },
      },
    ],
    current: { label: '当前方案' },
    baseline: { label: '对照方案' },
    metrics: [
      { key: 'enemyHpDelta', label: 'HP', unit: 'hp', ...metric(100, 80) },
    ],
    actors: [
      {
        key: 'actor-1',
        name: '末音',
        metrics: {
          enemyHpDelta: metric(100, 80),
          enemyToughnessDelta: metric(10, 8),
          selfEnergyDelta: metric(5, 4),
        },
      },
    ],
    actions: [
      {
        key: 'action-1',
        currentActionId: 'action-1',
        baselineActionId: 'action-1',
        currentName: '普通攻击',
        baselineName: '普通攻击',
        actorName: '末音',
        currentStatePointId: 'current-point',
        baselineStatePointId: 'baseline-point',
        currentFrameIndex: 18,
        baselineFrameIndex: 12,
        changed: true,
        metrics: {
          enemyHpDelta: metric(100, 80),
          enemyToughnessDelta: metric(10, 8),
          selfEnergyDelta: metric(5, 4),
          startMs: metric(300, 200),
          durationMs: metric(600, 600),
          hitCount: metric(1, 1),
          effectEventCount: metric(0, 0),
        },
      },
    ],
    effects: [],
    summary: { changedActionCount: 1 },
  };
}

function scenario(id, name, actionId) {
  return {
    id,
    name,
    draft: { actionDrafts: [{ id: actionId }] },
  };
}
