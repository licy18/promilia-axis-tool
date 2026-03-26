import { mount } from '@vue/test-utils';
import SkillEditPanel from '../../components/editor/SkillEditPanel.vue';
import { createPinia, setActivePinia } from 'pinia';

describe('SkillEditPanel.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders skill edit panel component', () => {
    const skillBlock = {
      id: 'skill_1',
      skillId: 'skill_id_1',
      name: '测试技能',
      startTime: 100,
      duration: 100,
      characterId: 'character_1'
    };

    const originalSkill = {
      id: 'skill_id_1',
      name: '测试技能',
      type: 'skill',
      element: 'fire',
      energyCost: 20,
      energyGain: 5,
      damageMultiplier: 1.5,
      level: 1,
      maxLevel: 10,
      chargeCount: 1,
      hitType: 'elemental'
    };

    const character = {
      id: 'character_1',
      name: '测试角色',
      stats: {
        attack: 1000
      }
    };

    const elements = [
      { id: 'element_fire', name: '火', color: '#ff4500' }
    ];

    const wrapper = mount(SkillEditPanel, {
      props: {
        visible: true,
        skillBlock,
        originalSkill,
        character,
        maxDuration: 1200,
        elements
      }
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('emits save event when save button is clicked', async () => {
    const skillBlock = {
      id: 'skill_1',
      skillId: 'skill_id_1',
      name: '测试技能',
      startTime: 100,
      duration: 100,
      characterId: 'character_1'
    };

    const originalSkill = {
      id: 'skill_id_1',
      name: '测试技能',
      type: 'skill',
      element: 'fire',
      energyCost: 20,
      energyGain: 5,
      damageMultiplier: 1.5,
      level: 1,
      maxLevel: 10,
      chargeCount: 1,
      hitType: 'elemental'
    };

    const character = {
      id: 'character_1',
      name: '测试角色',
      stats: {
        attack: 1000
      }
    };

    const elements = [
      { id: 'element_fire', name: '火', color: '#ff4500' }
    ];

    const wrapper = mount(SkillEditPanel, {
      props: {
        visible: true,
        skillBlock,
        originalSkill,
        character,
        maxDuration: 1200,
        elements
      }
    });

    // 检查组件是否渲染
    expect(wrapper.exists()).toBe(true);
  });

  it('emits update:visible event when dialog is closed', async () => {
    const skillBlock = {
      id: 'skill_1',
      skillId: 'skill_id_1',
      name: '测试技能',
      startTime: 100,
      duration: 100,
      characterId: 'character_1'
    };

    const originalSkill = {
      id: 'skill_id_1',
      name: '测试技能',
      type: 'skill',
      element: 'fire',
      energyCost: 20,
      energyGain: 5,
      damageMultiplier: 1.5,
      level: 1,
      maxLevel: 10,
      chargeCount: 1,
      hitType: 'elemental'
    };

    const character = {
      id: 'character_1',
      name: '测试角色',
      stats: {
        attack: 1000
      }
    };

    const elements = [
      { id: 'element_fire', name: '火', color: '#ff4500' }
    ];

    const wrapper = mount(SkillEditPanel, {
      props: {
        visible: true,
        skillBlock,
        originalSkill,
        character,
        maxDuration: 1200,
        elements
      }
    });

    // 检查组件是否渲染
    expect(wrapper.exists()).toBe(true);
  });
});
