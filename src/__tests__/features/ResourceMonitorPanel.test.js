import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ResourceMonitorPanel from '../../features/workbench/ResourceMonitorPanel.vue';

function createResourceTimeline(count) {
  return Array.from({ length: count }, (_, index) => ({
    actionId: `action-${Math.floor(index / 10)}`,
    resource: 'sp',
    timeMs: index * 100,
    change: 0.02,
    sourceDeltaId: `delta-${index}`,
  }));
}

describe('ResourceMonitorPanel', () => {
  it('keeps the complete resource timeline while mounting only a small window', () => {
    const wrapper = mount(ResourceMonitorPanel, {
      props: {
        resourceTimeline: createResourceTimeline(1_207),
        summary: {
          projectedHitCount: 0,
        },
        diagnostics: {
          limitations: [],
        },
      },
    });

    const window = wrapper.get(
      '[data-testid="workbench-resource-timeline-window"]'
    );
    expect(window.attributes('data-item-count')).toBe('1207');
    expect(Number(window.attributes('data-mounted-row-count'))).toBeLessThan(
      20
    );
    expect(wrapper.findAll('.resource-row').length).toBeLessThan(20);
  });
});
