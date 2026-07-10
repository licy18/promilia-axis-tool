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
});

function scenario(id, name, actionId) {
  return {
    id,
    name,
    draft: { actionDrafts: [{ id: actionId }] },
  };
}
