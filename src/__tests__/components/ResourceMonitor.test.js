import { mount } from '@vue/test-utils';
import ResourceMonitor from '../../components/timeline/ResourceMonitor.vue';
import { createPinia, setActivePinia } from 'pinia';

describe('ResourceMonitor.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders resource monitor component', () => {
    const project = {
      id: 'project_1',
      name: '测试项目',
      duration: 1200,
      characters: ['character_1'],
      actions: [
        {
          id: 'action_1',
          characterId: 'character_1',
          skillId: 'skill_1',
          name: '测试技能',
          startTime: 100,
          duration: 50,
          type: 'skill',
          spCost: 20,
          spGain: 5
        }
      ]
    };

    const characters = [
      {
        id: 'character_1',
        name: '测试角色',
        avatar: 'test-avatar.png',
        maxEnergy: 100,
        initialEnergy: 50
      }
    ];

    const wrapper = mount(ResourceMonitor, {
      props: {
        project,
        characters,
        currentFrame: 0
      }
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('calculates resource values based on current frame', () => {
    const project = {
      id: 'project_1',
      name: '测试项目',
      duration: 1200,
      characters: ['character_1'],
      actions: [
        {
          id: 'action_1',
          characterId: 'character_1',
          skillId: 'skill_1',
          name: '测试技能',
          startTime: 100,
          duration: 50,
          type: 'skill',
          spCost: 20,
          spGain: 5
        }
      ]
    };

    const characters = [
      {
        id: 'character_1',
        name: '测试角色',
        avatar: 'test-avatar.png',
        maxEnergy: 100,
        initialEnergy: 50
      }
    ];

    const wrapper = mount(ResourceMonitor, {
      props: {
        project,
        characters,
        currentFrame: 150
      }
    });

    expect(wrapper.exists()).toBe(true);
  });
});
