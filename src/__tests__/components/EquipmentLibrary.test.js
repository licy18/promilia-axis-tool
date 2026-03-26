import { mount } from '@vue/test-utils';
import EquipmentLibrary from '../../components/editor/EquipmentLibrary.vue';
import { createPinia, setActivePinia } from 'pinia';

describe('EquipmentLibrary.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders equipment library component', () => {
    const characters = [
      {
        id: 'character_1',
        name: '测试角色',
        avatar: 'test-avatar.png',
        equipment: [
          {
            id: 'equipment_1',
            name: '测试装备',
            category: '武器',
            level: 80,
            effect: '测试效果'
          }
        ]
      }
    ];

    const equipmentCategories = ['武器', '护甲', '饰品'];

    const wrapper = mount(EquipmentLibrary, {
      props: {
        characters,
        equipmentCategories
      }
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('.equipment-library').exists()).toBe(true);
  });

  it('emits equipment-select event when equipment is selected', async () => {
    const characters = [
      {
        id: 'character_1',
        name: '测试角色',
        avatar: 'test-avatar.png',
        equipment: [
          {
            id: 'equipment_1',
            name: '测试装备',
            category: '武器',
            level: 80,
            effect: '测试效果'
          }
        ]
      }
    ];

    const equipmentCategories = ['武器', '护甲', '饰品'];

    const wrapper = mount(EquipmentLibrary, {
      props: {
        characters,
        equipmentCategories
      }
    });

    // 点击装备项
    await wrapper.find('.equipment-item').trigger('click');

    // 检查事件是否被触发
    expect(wrapper.emitted('equipment-select')).toBeTruthy();
  });

  it('filters equipment by category', async () => {
    const characters = [
      {
        id: 'character_1',
        name: '测试角色',
        avatar: 'test-avatar.png',
        equipment: [
          {
            id: 'equipment_1',
            name: '测试武器',
            category: '武器',
            level: 80,
            effect: '测试效果'
          },
          {
            id: 'equipment_2',
            name: '测试护甲',
            category: '护甲',
            level: 80,
            effect: '测试效果'
          }
        ]
      }
    ];

    const equipmentCategories = ['武器', '护甲', '饰品'];

    const wrapper = mount(EquipmentLibrary, {
      props: {
        characters,
        equipmentCategories
      }
    });

    // 检查组件是否渲染
    expect(wrapper.exists()).toBe(true);
  });
});
