import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import WorkbenchProjectDropOverlay from '../../features/workbench/WorkbenchProjectDropOverlay.vue';

describe('WorkbenchProjectDropOverlay', () => {
  it('shows accepted formats for an external file and emits the drop', async () => {
    const wrapper = mount(WorkbenchProjectDropOverlay);
    const file = new File(['{}'], 'axis.json', { type: 'application/json' });
    const dataTransfer = { types: ['Files'], files: [file], dropEffect: 'none' };

    window.dispatchEvent(createDragEvent('dragenter', dataTransfer));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('释放以导入项目');
    expect(wrapper.text()).toContain('JSON / PNG');
    window.dispatchEvent(createDragEvent('drop', dataTransfer));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('files')).toEqual([[[file]]]);
    expect(wrapper.find('[data-testid="workbench-project-drop-overlay"]').exists()).toBe(
      false
    );
  });
});

function createDragEvent(type, dataTransfer) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  return event;
}
