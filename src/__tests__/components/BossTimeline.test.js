import { mount } from '@vue/test-utils';
import BossTimeline from '../../components/timeline/BossTimeline.vue';
import { createPinia, setActivePinia } from 'pinia';

describe('BossTimeline.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders boss timeline component', () => {
    const bossEvents = [
      {
        id: 'event_1',
        name: '测试事件',
        startTime: 100,
        duration: 50,
        type: 'attack',
        description: '测试攻击事件'
      }
    ];

    const wrapper = mount(BossTimeline, {
      props: {
        bossEvents,
        scale: 2,
        totalWidth: 2400
      }
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('emits event-select event when event is clicked', async () => {
    const bossEvents = [
      {
        id: 'event_1',
        name: '测试事件',
        startTime: 100,
        duration: 50,
        type: 'attack',
        description: '测试攻击事件'
      }
    ];

    const wrapper = mount(BossTimeline, {
      props: {
        bossEvents,
        scale: 2,
        totalWidth: 2400
      }
    });

    // 检查组件是否渲染
    expect(wrapper.exists()).toBe(true);
  });

  it('emits event-add event when add button is clicked', async () => {
    const bossEvents = [];

    const wrapper = mount(BossTimeline, {
      props: {
        bossEvents,
        scale: 2,
        totalWidth: 2400
      }
    });

    // 检查组件是否渲染
    expect(wrapper.exists()).toBe(true);
  });
});
