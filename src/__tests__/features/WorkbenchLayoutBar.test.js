import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import WorkbenchLayoutBar from '../../features/workbench/WorkbenchLayoutBar.vue';

describe('WorkbenchLayoutBar', () => {
  it('switches complete modes and exposes both side panel controls', async () => {
    const wrapper = mount(WorkbenchLayoutBar, {
      props: {
        layout: {
          mode: 'balanced',
          leftPanelCollapsed: false,
          rightPanelCollapsed: false,
        },
      },
    });

    await wrapper
      .get('[data-testid="workbench-layout-mode"][data-layout-mode="review"]')
      .trigger('click');
    await wrapper
      .get('[data-testid="workbench-toggle-left-panel"]')
      .trigger('click');
    await wrapper
      .get('[data-testid="workbench-toggle-right-panel"]')
      .trigger('click');
    await wrapper
      .get('[data-testid="workbench-reset-layout"]')
      .trigger('click');

    expect(wrapper.emitted('set-mode')?.at(-1)?.[0]).toBe('review');
    expect(wrapper.emitted('toggle-panel')).toEqual([['left'], ['right']]);
    expect(wrapper.emitted('reset')).toHaveLength(1);
  });
});
