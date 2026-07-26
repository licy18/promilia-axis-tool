import { mount } from '@vue/test-utils';
import { h, nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import WindowedList from '../../features/workbench/WindowedList.vue';

describe('WindowedList', () => {
  it('mounts a bounded window and scrolls an offscreen selection into view', async () => {
    const items = Array.from({ length: 5000 }, (_, index) => ({
      id: `row-${index}`,
      label: `Row ${index}`,
    }));
    const wrapper = mount(WindowedList, {
      attachTo: document.body,
      props: {
        items,
        itemHeight: 32,
        maxHeight: 320,
        overscan: 4,
        itemKey: 'id',
        selectedIndex: -1,
      },
      slots: {
        default: ({ item, index }) =>
          h(
            'span',
            {
              'data-testid': 'windowed-row',
              'data-index': index,
            },
            item.label
          ),
      },
    });

    expect(
      wrapper.findAll('[data-testid="windowed-row"]').length
    ).toBeLessThanOrEqual(20);
    expect(wrapper.attributes()).toMatchObject({
      'data-item-count': '5000',
      'data-window-start': '0',
    });

    await wrapper.setProps({ selectedIndex: 4999 });
    await vi.waitFor(() => {
      expect(wrapper.attributes('data-window-end')).toBe('5000');
    });

    expect(
      wrapper.get('[data-testid="windowed-row"][data-index="4999"]').text()
    ).toBe('Row 4999');
    expect(
      wrapper.findAll('[data-testid="windowed-row"]').length
    ).toBeLessThanOrEqual(20);

    wrapper.unmount();
  });

  it('re-clamps the visible window when the data set shrinks', async () => {
    const items = Array.from({ length: 1000 }, (_, index) => ({
      id: `row-${index}`,
    }));
    const wrapper = mount(WindowedList, {
      attachTo: document.body,
      props: {
        items,
        itemHeight: 40,
        maxHeight: 240,
        selectedIndex: 999,
      },
      slots: {
        default: ({ index }) =>
          h('span', {
            'data-testid': 'windowed-row',
            'data-index': index,
          }),
      },
    });
    await nextTick();

    await wrapper.setProps({ items: items.slice(0, 12), selectedIndex: 11 });
    await nextTick();
    await vi.waitFor(() => {
      expect(wrapper.attributes('data-window-end')).toBe('12');
    });

    expect(
      wrapper.get('[data-testid="windowed-row"][data-index="11"]').exists()
    ).toBe(true);
    expect(
      Number(wrapper.attributes('data-mounted-row-count'))
    ).toBeLessThanOrEqual(12);

    wrapper.unmount();
  });
});
