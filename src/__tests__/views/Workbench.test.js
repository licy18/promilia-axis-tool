import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import Workbench from '../../views/Workbench.vue';

describe('Workbench view', () => {
  it('renders the first real-data simulation slice', () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const text = wrapper.text();

    expect(text).toContain('首条垂直切片：末音普攻对迅狼');
    expect(text).toContain('末音');
    expect(text).toContain('迅狼');
    expect(text).toContain('哈库茵剑舞');
    expect(text).toContain('DAMAGE_PROJECTED');
    expect(text).toContain('stage3-raw-attack-multiplier-v1');
    expect(text).toContain('low');
  });
});
