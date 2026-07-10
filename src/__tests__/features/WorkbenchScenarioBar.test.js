import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import WorkbenchScenarioBar from '../../features/workbench/WorkbenchScenarioBar.vue';

describe('WorkbenchScenarioBar', () => {
  it('switches, adds, duplicates, renames, and deletes from one compact bar', async () => {
    const wrapper = mount(WorkbenchScenarioBar, {
      props: {
        workspace: workspace(),
        maxScenarios: 14,
      },
    });

    expect(wrapper.attributes()).toMatchObject({
      'data-active-scenario-id': 'scenario-0001',
      'data-scenario-count': '2',
    });
    expect(
      wrapper.findAll('[data-testid="workbench-scenario-tab"]')
    ).toHaveLength(2);

    await wrapper.find('[data-scenario-id="scenario-0002"]').trigger('click');
    expect(wrapper.emitted('switch')?.[0]).toEqual(['scenario-0002']);

    await wrapper
      .find('[data-testid="workbench-scenario-add"]')
      .trigger('click');
    await wrapper
      .find('[data-testid="workbench-scenario-duplicate"]')
      .trigger('click');
    await wrapper
      .find('[data-testid="workbench-scenario-delete"]')
      .trigger('click');
    expect(wrapper.emitted('add')).toHaveLength(1);
    expect(wrapper.emitted('duplicate')?.[0]).toEqual(['scenario-0001']);
    expect(wrapper.emitted('delete')?.[0]).toEqual(['scenario-0001']);

    await wrapper
      .find('[data-testid="workbench-scenario-rename"]')
      .trigger('click');
    await nextTick();
    const input = wrapper.get(
      '[data-testid="workbench-scenario-rename-input"]'
    );
    await input.setValue('爆发方案');
    await input.trigger('keydown.enter');
    expect(wrapper.emitted('rename')?.[0]).toEqual([
      { scenarioId: 'scenario-0001', name: '爆发方案' },
    ]);
  });

  it('prevents deleting the last scenario and adding past the limit', () => {
    const single = mount(WorkbenchScenarioBar, {
      props: {
        workspace: {
          activeScenarioId: 'scenario-0001',
          scenarios: [{ id: 'scenario-0001', name: '方案 1', draft: {} }],
        },
        maxScenarios: 1,
      },
    });

    expect(
      single.get('[data-testid="workbench-scenario-delete"]').attributes()
    ).toHaveProperty('disabled');
    expect(
      single.get('[data-testid="workbench-scenario-add"]').attributes()
    ).toHaveProperty('disabled');
    expect(
      single.get('[data-testid="workbench-scenario-duplicate"]').attributes()
    ).toHaveProperty('disabled');
  });
});

function workspace() {
  return {
    activeScenarioId: 'scenario-0001',
    scenarios: [
      { id: 'scenario-0001', name: '方案 1', draft: {} },
      { id: 'scenario-0002', name: '方案 2', draft: {} },
    ],
  };
}
